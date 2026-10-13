const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { validateReleaseGate } = require("../scripts/verify-release-gate");

describe("final release gate", () => {
  const releaseSha = "a".repeat(40);
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "release-gate-test-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  test("passes only when every required evidence item and operational control is approved", async () => {
    const gates = ["staging-smoke", "topology-transaction"];
    const smokeChecks = [
      "frontend-root", "frontend-spa-fallback", "frontend-api-target",
      "liveness", "readiness", "anonymous-protection", "login", "auth-session",
      "customer-read", "checkin-read", "pos-read", "report-summary",
    ];
    const details = {
      "staging-smoke": {
        preflightPassed: true,
        loginFlowExecuted: true,
        authenticatedChecksExecuted: true,
        results: smokeChecks.map((name) => ({ name, passed: true })),
      },
      "topology-transaction": {
        mongo: { deploymentType: "replica-set" },
        redis: { ping: "PONG" },
        transactionProbe: { executed: true, passed: true },
        instances: [{ origin: "https://one.example" }, { origin: "https://two.example" }],
        multiInstance: { passed: true },
      },
    };
    for (const gate of gates) {
      await fs.writeFile(path.join(directory, `${gate}.json`), JSON.stringify({
        gate,
        generatedAt: "2026-09-27T00:00:00.000Z",
        releaseSha,
        approvedBy: "release-owner",
        success: true,
        ...details[gate],
      }));
    }
    const manifest = {
      releaseSha,
      approvedBy: "release-owner",
      controls: {
        rollbackTested: true,
        monitoringConfigured: true,
        alertingConfigured: true,
        rpoRtoApproved: true,
        riskRegisterReviewed: true,
      },
      evidence: gates.map((gate) => ({ gate, path: `${gate}.json` })),
    };

    const result = await validateReleaseGate({
      manifest,
      manifestDirectory: directory,
      expectedRelease: releaseSha,
      requiredGates: gates,
    });

    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test("rejects a generic success document that lacks gate-specific proof", async () => {
    await fs.writeFile(path.join(directory, "load.json"), JSON.stringify({
      gate: "staging-load",
      generatedAt: "2026-09-27T00:00:00.000Z",
      releaseSha,
      approvedBy: "release-owner",
      success: true,
    }));
    const result = await validateReleaseGate({
      manifest: {
        releaseSha,
        approvedBy: "release-owner",
        controls: Object.fromEntries([
          "rollbackTested", "monitoringConfigured", "alertingConfigured",
          "rpoRtoApproved", "riskRegisterReviewed",
        ].map((name) => [name, true])),
        evidence: [{ gate: "staging-load", path: "load.json" }],
      },
      manifestDirectory: directory,
      expectedRelease: releaseSha,
      requiredGates: ["staging-load"],
    });

    expect(result.success).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining("trafficStarted is not true"),
      expect.stringContaining("overall load result did not pass"),
    ]));
  });

  test("fails closed on a mismatched SHA, missing approval and unconfirmed controls", async () => {
    await fs.writeFile(path.join(directory, "smoke.json"), JSON.stringify({
      gate: "staging-smoke",
      generatedAt: "2026-09-27T00:00:00.000Z",
      releaseSha: "b".repeat(40),
      approvedBy: null,
      success: true,
    }));
    const result = await validateReleaseGate({
      manifest: {
        releaseSha: "b".repeat(40),
        approvedBy: "",
        controls: {},
        evidence: [{ gate: "staging-smoke", path: "smoke.json" }],
      },
      manifestDirectory: directory,
      expectedRelease: releaseSha,
      requiredGates: ["staging-smoke"],
    });

    expect(result.success).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      "Manifest releaseSha does not match RELEASE_SHA",
      "Manifest approvedBy is required",
      expect.stringContaining("releaseSha mismatch"),
      expect.stringContaining("approvedBy is missing"),
    ]));
  });
});
