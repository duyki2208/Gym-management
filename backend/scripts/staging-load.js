/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");

const percentile = (values, ratio) => values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)] || 0;
const baseUrl = String(process.env.STAGING_BASE_URL || "").replace(/\/$/, "");
const token = process.env.STAGING_ACCESS_TOKEN;
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || 60);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 8);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS || 1500);
const maxP99Ms = Number(process.env.LOAD_MAX_P99_MS || 3000);
const maxFailureRate = Number(process.env.LOAD_MAX_FAILURE_RATE || 0.01);
const minThroughputRps = Number(process.env.LOAD_MIN_THROUGHPUT_RPS || 0);
const requestTimeoutMs = Number(process.env.LOAD_REQUEST_TIMEOUT_MS || 10000);
const releaseSha = process.env.RELEASE_SHA || process.env.GITHUB_SHA || "unknown";
const requireReleaseSha = process.env.LOAD_REQUIRE_RELEASE_SHA === "true";
const endpoints = JSON.parse(process.env.LOAD_TRAFFIC_MIX || JSON.stringify([
  { name: "customers", path: "/api/v1/customers?page=1&limit=25", weight: 35 },
  { name: "checkins", path: "/api/v1/checkins?page=1&limit=25", weight: 25 },
  { name: "pos", path: "/api/v1/pos/sales?preset=today&page=1&limit=25", weight: 25 },
  { name: "report", path: "/api/v1/reports/summary", weight: 15 },
]));

if (!baseUrl || !token) throw new Error("STAGING_BASE_URL and STAGING_ACCESS_TOKEN are required");
if (requireReleaseSha && releaseSha === "unknown") throw new Error("LOAD_REQUIRE_RELEASE_SHA=true requires RELEASE_SHA or GITHUB_SHA");
if (!baseUrl.startsWith("https://") && process.env.ALLOW_INSECURE_STAGING !== "true") {
  throw new Error("STAGING_BASE_URL must use HTTPS");
}
const minimumDurationSeconds = process.env.LOAD_ALLOW_SHORT_TEST === "true" ? 1 : 10;
if (!Number.isFinite(durationSeconds) || durationSeconds < minimumDurationSeconds || durationSeconds > 3600) throw new Error(`LOAD_DURATION_SECONDS must be ${minimumDurationSeconds}..3600`);
if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 100) throw new Error("LOAD_CONCURRENCY must be 1..100");
if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 60000) throw new Error("LOAD_REQUEST_TIMEOUT_MS must be 100..60000");
if (!Number.isFinite(maxP95Ms) || maxP95Ms < 1 || maxP95Ms > requestTimeoutMs) throw new Error("LOAD_MAX_P95_MS must be 1..LOAD_REQUEST_TIMEOUT_MS");
if (!Number.isFinite(maxP99Ms) || maxP99Ms < maxP95Ms || maxP99Ms > requestTimeoutMs) throw new Error("LOAD_MAX_P99_MS must be LOAD_MAX_P95_MS..LOAD_REQUEST_TIMEOUT_MS");
if (!Number.isFinite(maxFailureRate) || maxFailureRate < 0 || maxFailureRate > 1) throw new Error("LOAD_MAX_FAILURE_RATE must be 0..1");
if (!Number.isFinite(minThroughputRps) || minThroughputRps < 0) throw new Error("LOAD_MIN_THROUGHPUT_RPS must be non-negative");
if (!Array.isArray(endpoints) || endpoints.length === 0 || endpoints.length > 20) throw new Error("LOAD_TRAFFIC_MIX must contain 1..20 endpoints");
const endpointNames = new Set();
for (const endpoint of endpoints) {
  if (!endpoint || typeof endpoint.name !== "string" || !endpoint.name.trim()) throw new Error("Each load endpoint requires a name");
  if (endpointNames.has(endpoint.name)) throw new Error(`Duplicate load endpoint name: ${endpoint.name}`);
  endpointNames.add(endpoint.name);
  if (typeof endpoint.path !== "string" || !endpoint.path.startsWith("/api/v1/")) throw new Error(`Invalid API path for ${endpoint.name}`);
  if (!Number.isFinite(endpoint.weight) || endpoint.weight <= 0 || endpoint.weight > 1000) throw new Error(`Invalid weight for ${endpoint.name}`);
}

const totalWeight = endpoints.reduce((sum, endpoint) => sum + endpoint.weight, 0);
const pickEndpoint = (position) => {
  let offset = position % totalWeight;
  for (const endpoint of endpoints) {
    if (offset < endpoint.weight) return endpoint;
    offset -= endpoint.weight;
  }
  return endpoints[endpoints.length - 1];
};
const stats = new Map(endpoints.map((item) => [item.name, { ...item, latencies: [], requests: 0, failures: 0, bytes: 0 }]));

const writeEvidence = async (evidence) => {
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (process.env.EVIDENCE_OUTPUT) {
    await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
    await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
  }
  console.log(serialized);
};

const runPreflight = async () => {
  const checks = [
    { name: "liveness", path: "/api/v1/system/health/live" },
    { name: "readiness", path: "/api/v1/system/health/ready", readiness: true },
  ];
  const results = [];
  for (const check of checks) {
    const requestId = `staging-load-preflight-${Date.now()}-${check.name}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const startedAt = process.hrtime.bigint();
    try {
      const response = await fetch(`${baseUrl}${check.path}`, {
        headers: { "x-request-id": requestId },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const dependencies = check.readiness ? body?.data?.dependencies : null;
      const dependenciesReady = !check.readiness || (
        dependencies?.defaultDatabase === true &&
        dependencies?.centralDatabase === true &&
        dependencies?.sharedCache === true &&
        dependencies?.transactions === true
      );
      const reportedRelease = body?.data?.release || null;
      const releaseMatches = releaseSha === "unknown" || reportedRelease === releaseSha;
      results.push({
        name: check.name,
        path: check.path,
        expectedStatus: 200,
        actualStatus: response.status,
        latencyMs: Number(latencyMs.toFixed(2)),
        requestIdPropagated: response.headers.get("x-request-id") === requestId,
        reportedRelease,
        dependencies,
        passed: response.status === 200 &&
          latencyMs <= requestTimeoutMs &&
          response.headers.get("x-request-id") === requestId &&
          releaseMatches &&
          dependenciesReady,
      });
    } catch (error) {
      results.push({ name: check.name, path: check.path, passed: false, error: error.name });
    } finally {
      clearTimeout(timer);
    }
  }
  return { passed: results.every((item) => item.passed), results };
};

const main = async () => {
  const preflight = await runPreflight();
  if (!preflight.passed) {
    await writeEvidence({
      gate: "staging-load",
      generatedAt: new Date().toISOString(),
      environment: "staging",
      releaseSha,
      executedBy: process.env.EVIDENCE_EXECUTED_BY || process.env.GITHUB_ACTOR || "unknown",
      approvedBy: process.env.EVIDENCE_APPROVED_BY || null,
      baseUrl: new URL(baseUrl).origin,
      durationSeconds: 0,
      concurrency,
      trafficStarted: false,
      preflight,
      thresholds: { maxP95Ms, maxP99Ms, maxFailureRate, minThroughputRps, requestTimeoutMs },
      trafficMix: endpoints.map(({ name, path: endpointPath, weight }) => ({ name, path: endpointPath, weight })),
      success: false,
      overall: null,
      results: [],
    });
    process.exitCode = 1;
    return;
  }
  const deadline = Date.now() + durationSeconds * 1000;
  let cursor = 0;
  const worker = async () => {
    while (Date.now() < deadline) {
      const endpoint = pickEndpoint(cursor++);
      const item = stats.get(endpoint.name);
      const startedAt = process.hrtime.bigint();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-request-id": `staging-load-${process.pid}-${cursor}`,
          },
          signal: controller.signal,
        });
        const body = await response.arrayBuffer();
        item.bytes += body.byteLength;
        if (!response.ok) item.failures += 1;
      } catch {
        item.failures += 1;
      } finally {
        clearTimeout(timer);
      }
      item.requests += 1;
      item.latencies.push(Number(process.hrtime.bigint() - startedAt) / 1e6);
    }
  };
  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const actualDurationSeconds = (Date.now() - startedAt) / 1000;
  const results = [...stats.values()].map((item) => {
    item.latencies.sort((a, b) => a - b);
    const failureRate = item.requests ? item.failures / item.requests : 1;
    const p95 = percentile(item.latencies, 0.95);
    const p99 = percentile(item.latencies, 0.99);
    return {
      name: item.name,
      path: item.path,
      weight: item.weight,
      requests: item.requests,
      failures: item.failures,
      failureRate: Number(failureRate.toFixed(6)),
      throughputRps: Number((item.requests / actualDurationSeconds).toFixed(2)),
      averageResponseBytes: Math.round(item.bytes / Math.max(1, item.requests)),
      latencyMs: {
        p50: Number(percentile(item.latencies, 0.5).toFixed(2)),
        p95: Number(p95.toFixed(2)),
        p99: Number(p99.toFixed(2)),
        max: Number(percentile(item.latencies, 1).toFixed(2)),
      },
      passed: failureRate <= maxFailureRate && p95 <= maxP95Ms && p99 <= maxP99Ms,
    };
  });
  const allLatencies = [...stats.values()].flatMap((item) => item.latencies).sort((a, b) => a - b);
  const totalRequests = results.reduce((sum, item) => sum + item.requests, 0);
  const totalFailures = results.reduce((sum, item) => sum + item.failures, 0);
  const totalBytes = [...stats.values()].reduce((sum, item) => sum + item.bytes, 0);
  const overallFailureRate = totalRequests > 0 ? totalFailures / totalRequests : 1;
  const overallThroughputRps = totalRequests / actualDurationSeconds;
  const overall = {
    requests: totalRequests,
    failures: totalFailures,
    failureRate: Number(overallFailureRate.toFixed(6)),
    throughputRps: Number(overallThroughputRps.toFixed(2)),
    responseBytes: totalBytes,
    latencyMs: {
      p50: Number(percentile(allLatencies, 0.5).toFixed(2)),
      p95: Number(percentile(allLatencies, 0.95).toFixed(2)),
      p99: Number(percentile(allLatencies, 0.99).toFixed(2)),
      max: Number(percentile(allLatencies, 1).toFixed(2)),
    },
  };
  overall.passed = overall.failureRate <= maxFailureRate &&
    overall.latencyMs.p95 <= maxP95Ms &&
    overall.latencyMs.p99 <= maxP99Ms &&
    overall.throughputRps >= minThroughputRps;
  const evidence = {
    gate: "staging-load",
    generatedAt: new Date().toISOString(),
    environment: "staging",
    releaseSha,
    executedBy: process.env.EVIDENCE_EXECUTED_BY || process.env.GITHUB_ACTOR || "unknown",
    approvedBy: process.env.EVIDENCE_APPROVED_BY || null,
    baseUrl: new URL(baseUrl).origin,
    durationSeconds: Number(actualDurationSeconds.toFixed(2)),
    concurrency,
    trafficStarted: true,
    preflight,
    thresholds: { maxP95Ms, maxP99Ms, maxFailureRate, minThroughputRps, requestTimeoutMs },
    trafficMix: endpoints.map(({ name, path: endpointPath, weight }) => ({ name, path: endpointPath, weight })),
    success: results.every((item) => item.passed) && overall.passed,
    overall,
    results,
  };
  await writeEvidence(evidence);
  if (!evidence.success) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
