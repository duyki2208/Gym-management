/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_REQUIRED_GATES = Object.freeze([
  "staging-smoke",
  "staging-load",
  "topology-transaction",
  "provider-restore",
  "secret-rotation",
  "security-scan",
  "face-evaluation",
]);

const REQUIRED_CONTROLS = Object.freeze([
  "rollbackTested",
  "monitoringConfigured",
  "alertingConfigured",
  "rpoRtoApproved",
  "riskRegisterReviewed",
]);

const isReleaseSha = (value) => typeof value === "string" && /^[a-f0-9]{7,64}$/i.test(value);
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const allPassed = (items) => Array.isArray(items) && items.length > 0 && items.every((item) => item?.passed === true);

const validateGateEvidence = (gate, evidence) => {
  const failures = [];
  if (gate === "staging-smoke") {
    const requiredChecks = [
      "frontend-root", "frontend-spa-fallback", "frontend-api-target",
      "liveness", "readiness", "anonymous-protection", "login",
      "auth-session", "customer-read", "checkin-read", "pos-read", "report-summary",
    ];
    const results = Array.isArray(evidence.results) ? evidence.results : [];
    if (evidence.preflightPassed !== true) failures.push("preflightPassed is not true");
    if (evidence.loginFlowExecuted !== true) failures.push("loginFlowExecuted is not true");
    if (evidence.authenticatedChecksExecuted !== true) failures.push("authenticatedChecksExecuted is not true");
    for (const name of requiredChecks) {
      if (!results.some((item) => item?.name === name && item.passed === true)) failures.push(`required check did not pass: ${name}`);
    }
  } else if (gate === "staging-load") {
    if (evidence.trafficStarted !== true) failures.push("trafficStarted is not true");
    if (evidence.preflight?.passed !== true) failures.push("load preflight did not pass");
    if (evidence.overall?.passed !== true) failures.push("overall load result did not pass");
    if (!allPassed(evidence.results)) failures.push("per-endpoint load results did not all pass");
  } else if (gate === "topology-transaction") {
    if (!["replica-set", "sharded"].includes(evidence.mongo?.deploymentType)) failures.push("Mongo deployment is not replica-set/sharded");
    if (evidence.redis?.ping !== "PONG") failures.push("Redis PING did not pass");
    if (evidence.transactionProbe?.executed !== true || evidence.transactionProbe?.passed !== true) failures.push("transaction commit/rollback probe did not pass");
    if (!Array.isArray(evidence.instances) || evidence.instances.length < 2) failures.push("fewer than two backend instances were verified");
    if (evidence.multiInstance?.passed !== true) failures.push("multi-instance session/readiness checks did not pass");
  } else if (gate === "provider-restore") {
    if (evidence.integrityPassed !== true) failures.push("restore integrity did not pass");
    if (evidence.objectivesMet !== true) failures.push("RPO/RTO objectives were not met");
    if (!Array.isArray(evidence.results) || evidence.results.length === 0) failures.push("restore collection results are missing");
  } else if (gate === "secret-rotation") {
    const providers = Array.isArray(evidence.providers) ? evidence.providers : [];
    if (providers.length === 0) failures.push("provider rotation records are missing");
    if (!providers.every((item) =>
      typeof item?.provider === "string" && item.provider.trim() &&
      item.oldCredentialRevoked === true &&
      item.newCredentialSmokePassed === true &&
      isTimestamp(item.rotatedAt) && isTimestamp(item.revokedAt)
    )) failures.push("not every provider proves rotation, revoke and post-rotation smoke");
  } else if (gate === "security-scan") {
    if (evidence.dependencyAuditPassed !== true) failures.push("dependency audit did not pass");
    if (evidence.containerScanPassed !== true) failures.push("container scan did not pass");
    if (evidence.secretScanPassed !== true) failures.push("secret scan did not pass");
  } else if (gate === "face-evaluation") {
    if (evidence.consentPassed !== true) failures.push("dataset consent did not pass");
    if (evidence.evaluationCompleted !== true) failures.push("face evaluation was not completed");
    const safeDecision = evidence.livenessPassed === true ||
      evidence.faceRecognitionDisabled === true ||
      evidence.riskAccepted === true;
    if (!safeDecision) failures.push("liveness pass, disabled control or explicit risk acceptance is required");
  }
  return failures;
};

const validateReleaseGate = async ({ manifest, manifestDirectory, expectedRelease, requiredGates = DEFAULT_REQUIRED_GATES }) => {
  const failures = [];
  if (!isReleaseSha(expectedRelease)) failures.push("RELEASE_SHA must be a 7..64 character hexadecimal commit SHA");
  if (manifest?.releaseSha !== expectedRelease) failures.push("Manifest releaseSha does not match RELEASE_SHA");
  if (typeof manifest?.approvedBy !== "string" || !manifest.approvedBy.trim()) failures.push("Manifest approvedBy is required");

  for (const control of REQUIRED_CONTROLS) {
    if (manifest?.controls?.[control] !== true) failures.push(`Required control is not confirmed: ${control}`);
  }

  const entries = Array.isArray(manifest?.evidence) ? manifest.evidence : [];
  const results = [];
  for (const gate of requiredGates) {
    const matches = entries.filter((entry) => entry?.gate === gate);
    if (matches.length !== 1) {
      failures.push(`Gate ${gate} must have exactly one evidence entry`);
      results.push({ gate, passed: false });
      continue;
    }
    const entry = matches[0];
    try {
      const evidencePath = path.resolve(manifestDirectory, entry.path);
      const evidence = JSON.parse(await fs.readFile(evidencePath, "utf8"));
      const gateFailures = [];
      if (evidence.gate !== gate) gateFailures.push("gate mismatch");
      if (evidence.success !== true) gateFailures.push("success is not true");
      if (evidence.releaseSha !== expectedRelease) gateFailures.push("releaseSha mismatch");
      if (!isTimestamp(evidence.generatedAt)) gateFailures.push("generatedAt is invalid");
      if (typeof evidence.approvedBy !== "string" || !evidence.approvedBy.trim()) gateFailures.push("approvedBy is missing");
      gateFailures.push(...validateGateEvidence(gate, evidence));
      if (gateFailures.length > 0) failures.push(`Gate ${gate}: ${gateFailures.join(", ")}`);
      results.push({ gate, passed: gateFailures.length === 0 });
    } catch (error) {
      failures.push(`Gate ${gate}: evidence cannot be read (${error.code || error.name})`);
      results.push({ gate, passed: false });
    }
  }

  return {
    gate: "final-release",
    generatedAt: new Date().toISOString(),
    releaseSha: expectedRelease,
    approvedBy: manifest?.approvedBy || null,
    success: failures.length === 0,
    controls: Object.fromEntries(REQUIRED_CONTROLS.map((control) => [control, manifest?.controls?.[control] === true])),
    results,
    failures,
  };
};

const main = async () => {
  const manifestPath = process.env.RELEASE_GATE_MANIFEST;
  const expectedRelease = process.env.RELEASE_SHA || process.env.GITHUB_SHA;
  if (!manifestPath) throw new Error("RELEASE_GATE_MANIFEST is required");
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(await fs.readFile(absoluteManifestPath, "utf8"));
  const requiredGates = process.env.RELEASE_GATE_REQUIRED_GATES
    ? process.env.RELEASE_GATE_REQUIRED_GATES.split(",").map((item) => item.trim()).filter(Boolean)
    : DEFAULT_REQUIRED_GATES;
  const evidence = await validateReleaseGate({
    manifest,
    manifestDirectory: path.dirname(absoluteManifestPath),
    expectedRelease,
    requiredGates,
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (process.env.EVIDENCE_OUTPUT) {
    await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
    await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
  }
  console.log(serialized);
  if (!evidence.success) process.exitCode = 1;
};

module.exports = { DEFAULT_REQUIRED_GATES, REQUIRED_CONTROLS, validateGateEvidence, validateReleaseGate };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
