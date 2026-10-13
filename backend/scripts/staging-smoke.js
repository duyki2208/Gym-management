/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");

const baseUrl = String(process.env.STAGING_BASE_URL || "").replace(/\/$/, "");
const configuredToken = process.env.STAGING_ACCESS_TOKEN;
const loginCredentials = {
  facilityKey: process.env.STAGING_LOGIN_FACILITY_KEY,
  username: process.env.STAGING_LOGIN_USERNAME,
  password: process.env.STAGING_LOGIN_PASSWORD,
};
const loginCredentialValues = Object.values(loginCredentials);
const hasAnyLoginCredential = loginCredentialValues.some(Boolean);
const hasCompleteLoginCredentials = loginCredentialValues.every(Boolean);
const requireLoginFlow = process.env.SMOKE_REQUIRE_LOGIN_FLOW === "true";
const frontendUrl = String(process.env.STAGING_FRONTEND_URL || "").replace(/\/$/, "");
const requireFrontendFlow = process.env.SMOKE_REQUIRE_FRONTEND_FLOW === "true";
const expectedApiBaseUrl = String(
  process.env.STAGING_EXPECTED_API_BASE_URL || `${baseUrl}/api/v1`
).replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10000);
const maxLatencyMs = Number(process.env.SMOKE_MAX_LATENCY_MS || 3000);
const releaseSha = process.env.RELEASE_SHA || process.env.GITHUB_SHA || "unknown";

if (!baseUrl) throw new Error("STAGING_BASE_URL is required");
if (hasAnyLoginCredential && !hasCompleteLoginCredentials) {
  throw new Error("STAGING_LOGIN_FACILITY_KEY, STAGING_LOGIN_USERNAME and STAGING_LOGIN_PASSWORD must be configured together");
}
if (requireLoginFlow && !hasCompleteLoginCredentials) {
  throw new Error("SMOKE_REQUIRE_LOGIN_FLOW=true requires the three STAGING_LOGIN_* credentials");
}
if (requireFrontendFlow && !frontendUrl) {
  throw new Error("SMOKE_REQUIRE_FRONTEND_FLOW=true requires STAGING_FRONTEND_URL");
}
if (!configuredToken && !hasCompleteLoginCredentials && process.env.SMOKE_ALLOW_ANONYMOUS_ONLY !== "true") {
  throw new Error("STAGING_ACCESS_TOKEN or the three STAGING_LOGIN_* credentials are required");
}
if (!baseUrl.startsWith("https://") && process.env.ALLOW_INSECURE_STAGING !== "true") {
  throw new Error("STAGING_BASE_URL must use HTTPS (or set ALLOW_INSECURE_STAGING=true locally)");
}
if (frontendUrl && !frontendUrl.startsWith("https://") && process.env.ALLOW_INSECURE_STAGING !== "true") {
  throw new Error("STAGING_FRONTEND_URL must use HTTPS (or set ALLOW_INSECURE_STAGING=true locally)");
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
  throw new Error("SMOKE_TIMEOUT_MS must be 100..60000");
}
if (!Number.isFinite(maxLatencyMs) || maxLatencyMs < 1 || maxLatencyMs > timeoutMs) {
  throw new Error("SMOKE_MAX_LATENCY_MS must be 1..SMOKE_TIMEOUT_MS");
}

const publicChecks = [
  { name: "liveness", path: "/api/v1/system/health/live", status: 200 },
  { name: "readiness", path: "/api/v1/system/health/ready", status: 200 },
  { name: "anonymous-protection", path: "/api/v1/customers?limit=1", status: 401 },
];

const authenticatedChecks = [
  { name: "auth-session", path: "/api/v1/auth/me", status: 200, auth: true },
  { name: "customer-read", path: "/api/v1/customers?page=1&limit=1", status: 200, auth: true },
  { name: "checkin-read", path: "/api/v1/checkins?page=1&limit=1", status: 200, auth: true },
  { name: "pos-read", path: "/api/v1/pos/sales?preset=today&page=1&limit=1", status: 200, auth: true },
  { name: "report-summary", path: "/api/v1/reports/summary", status: 200, auth: true },
];

let activeToken = configuredToken;

const fetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    return {
      status: response.status,
      body,
      latencyMs: Number((Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(2)),
    };
  } finally {
    clearTimeout(timer);
  }
};

const runFrontendPreflight = async () => {
  if (!frontendUrl) return [];
  try {
    const root = await fetchText(`${frontendUrl}/`);
    const deepLink = await fetchText(`${frontendUrl}/customers`);
    const rootHasApp = /<div[^>]+id=["']root["']/i.test(root.body);
    const deepLinkHasApp = /<div[^>]+id=["']root["']/i.test(deepLink.body);
    const scriptPaths = [...root.body.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)]
      .map((match) => match[1]);
    const scriptBodies = [];
    for (const scriptPath of scriptPaths) {
      const scriptUrl = new URL(scriptPath, `${frontendUrl}/`).toString();
      const script = await fetchText(scriptUrl);
      if (script.status === 200) scriptBodies.push(script.body);
    }
    const bundle = scriptBodies.join("\n");
    const apiTargetMatches = bundle.includes(expectedApiBaseUrl);
    const containsLocalhostFallback = expectedApiBaseUrl !== "http://localhost:5000/api/v1" &&
      bundle.includes("http://localhost:5000/api/v1");

    return [
      {
        name: "frontend-root",
        path: "/",
        expectedStatus: 200,
        actualStatus: root.status,
        latencyMs: root.latencyMs,
        passed: root.status === 200 && root.latencyMs <= maxLatencyMs && rootHasApp,
        responseBytes: Buffer.byteLength(root.body),
      },
      {
        name: "frontend-spa-fallback",
        path: "/customers",
        expectedStatus: 200,
        actualStatus: deepLink.status,
        latencyMs: deepLink.latencyMs,
        passed: deepLink.status === 200 && deepLink.latencyMs <= maxLatencyMs && deepLinkHasApp,
        responseBytes: Buffer.byteLength(deepLink.body),
      },
      {
        name: "frontend-api-target",
        expectedApiOrigin: new URL(expectedApiBaseUrl).origin,
        scriptCount: scriptPaths.length,
        passed: scriptPaths.length > 0 && apiTargetMatches && !containsLocalhostFallback,
      },
    ];
  } catch (error) {
    return [{ name: "frontend-preflight", passed: false, error: error.name }];
  }
};

const runCheck = async (check) => {
  const requestId = `staging-smoke-${Date.now()}-${check.name}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: {
        "x-request-id": requestId,
        ...(check.auth ? { Authorization: `Bearer ${activeToken}` } : {}),
      },
      signal: controller.signal,
    });
    const body = await response.text();
    const parsedBody = (() => {
      try { return JSON.parse(body); } catch { return null; }
    })();
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const requestIdPropagated = response.headers.get("x-request-id") === requestId;
    const readinessDependencies = check.name === "readiness"
      ? parsedBody?.data?.dependencies
      : null;
    const dependencyGatePassed = check.name !== "readiness" || (
      readinessDependencies?.defaultDatabase === true &&
      readinessDependencies?.centralDatabase === true &&
      readinessDependencies?.sharedCache === true &&
      readinessDependencies?.transactions === true
    );
    const reportedRelease = parsedBody?.data?.release || null;
    const releaseGatePassed = releaseSha === "unknown" ||
      !["liveness", "readiness"].includes(check.name) ||
      reportedRelease === releaseSha;
    return {
      name: check.name,
      path: check.path,
      expectedStatus: check.status,
      actualStatus: response.status,
      latencyMs: Number(latencyMs.toFixed(2)),
      requestIdPropagated,
      readinessDependencies,
      reportedRelease,
      passed: response.status === check.status &&
        latencyMs <= maxLatencyMs &&
        requestIdPropagated &&
        dependencyGatePassed &&
        releaseGatePassed,
      responseBytes: Buffer.byteLength(body),
    };
  } catch (error) {
    return { name: check.name, path: check.path, passed: false, error: error.name };
  } finally {
    clearTimeout(timer);
  }
};

const runLogin = async () => {
  const name = "login";
  const requestId = `staging-smoke-${Date.now()}-${name}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify(loginCredentials),
      signal: controller.signal,
    });
    const body = await response.text();
    const parsedBody = (() => {
      try { return JSON.parse(body); } catch { return null; }
    })();
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const requestIdPropagated = response.headers.get("x-request-id") === requestId;
    const issuedToken = typeof parsedBody?.token === "string" ? parsedBody.token : null;
    const passed = response.status === 200 &&
      latencyMs <= maxLatencyMs &&
      requestIdPropagated &&
      Boolean(issuedToken);
    return {
      result: {
        name,
        path: "/api/v1/auth/login",
        expectedStatus: 200,
        actualStatus: response.status,
        latencyMs: Number(latencyMs.toFixed(2)),
        requestIdPropagated,
        tokenIssued: Boolean(issuedToken),
        passed,
        responseBytes: Buffer.byteLength(body),
      },
      issuedToken,
    };
  } catch (error) {
    return {
      result: { name, path: "/api/v1/auth/login", passed: false, error: error.name },
      issuedToken: null,
    };
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  const results = await runFrontendPreflight();
  for (const check of publicChecks) results.push(await runCheck(check));

  const preflightPassed = results.every((item) => item.passed);
  let loginFlowExecuted = false;
  let authenticatedChecksExecuted = false;

  if (preflightPassed && hasCompleteLoginCredentials) {
    loginFlowExecuted = true;
    const login = await runLogin();
    results.push(login.result);
    if (login.issuedToken) activeToken = login.issuedToken;
  }
  if (preflightPassed && activeToken) {
    authenticatedChecksExecuted = true;
    for (const check of authenticatedChecks) results.push(await runCheck(check));
  }

  const skippedChecks = [];
  if (!loginFlowExecuted && hasCompleteLoginCredentials) skippedChecks.push("login");
  if (!authenticatedChecksExecuted && (configuredToken || hasCompleteLoginCredentials)) {
    skippedChecks.push(...authenticatedChecks.map((check) => check.name));
  }
  const evidence = {
    gate: "staging-smoke",
    generatedAt: new Date().toISOString(),
    environment: "staging",
    releaseSha,
    executedBy: process.env.EVIDENCE_EXECUTED_BY || process.env.GITHUB_ACTOR || "unknown",
    approvedBy: process.env.EVIDENCE_APPROVED_BY || null,
    baseUrl: new URL(baseUrl).origin,
    frontendOrigin: frontendUrl ? new URL(frontendUrl).origin : null,
    expectedApiOrigin: new URL(expectedApiBaseUrl).origin,
    authenticationMode: hasCompleteLoginCredentials ? "credentials" : (configuredToken ? "access-token" : "anonymous"),
    preflightPassed,
    loginFlowExecuted,
    authenticatedChecksEnabled: authenticatedChecksExecuted,
    authenticatedChecksExecuted,
    skippedChecks,
    thresholds: { timeoutMs, maxLatencyMs },
    success: results.every((item) => item.passed),
    results,
  };
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (process.env.EVIDENCE_OUTPUT) {
    await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
    await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
  }
  console.log(serialized);
  if (!evidence.success) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
