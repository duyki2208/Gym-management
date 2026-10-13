const { execFile } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

describe("staging load script", () => {
  test("records p95, p99, failure rate and aggregate throughput without leaking the token", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/v1/system/health/live" || req.url === "/api/v1/system/health/ready") {
        res.setHeader("content-type", "application/json");
        res.setHeader("x-request-id", req.headers["x-request-id"] || "missing");
        res.end(JSON.stringify({
          data: {
            release: "test-release",
            dependencies: {
              defaultDatabase: true,
              centralDatabase: true,
              sharedCache: true,
              transactions: true,
            },
          },
        }));
        return;
      }
      if (req.headers.authorization !== "Bearer load-test-token") {
        res.statusCode = 401;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ success: res.statusCode === 200 }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const scriptPath = path.resolve(__dirname, "../scripts/staging-load.js");
      const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          STAGING_BASE_URL: `http://127.0.0.1:${port}`,
          STAGING_ACCESS_TOKEN: "load-test-token",
          ALLOW_INSECURE_STAGING: "true",
          LOAD_ALLOW_SHORT_TEST: "true",
          LOAD_DURATION_SECONDS: "1",
          LOAD_CONCURRENCY: "2",
          LOAD_MAX_P95_MS: "1000",
          LOAD_MAX_P99_MS: "1500",
          LOAD_MIN_THROUGHPUT_RPS: "1",
          LOAD_REQUEST_TIMEOUT_MS: "2000",
          LOAD_REQUIRE_RELEASE_SHA: "true",
          RELEASE_SHA: "test-release",
        },
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
      });

      expect(stderr).toBe("");
      expect(stdout).not.toContain("load-test-token");
      const evidence = JSON.parse(stdout);
      expect(evidence.success).toBe(true);
      expect(evidence.trafficStarted).toBe(true);
      expect(evidence.preflight.passed).toBe(true);
      expect(evidence.overall.requests).toBeGreaterThan(0);
      expect(evidence.overall.throughputRps).toBeGreaterThanOrEqual(1);
      expect(evidence.overall.failureRate).toBe(0);
      expect(evidence.overall.latencyMs).toEqual({
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        max: expect.any(Number),
      });
      expect(evidence.results).toHaveLength(4);
      expect(evidence.results.every((item) => item.passed)).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("does not send the token or traffic when release preflight fails", async () => {
    let authorizedRequests = 0;
    const server = http.createServer((req, res) => {
      if (req.headers.authorization) authorizedRequests += 1;
      res.setHeader("content-type", "application/json");
      res.setHeader("x-request-id", req.headers["x-request-id"] || "missing");
      res.end(JSON.stringify({ data: { release: "wrong-release", dependencies: {} } }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const scriptPath = path.resolve(__dirname, "../scripts/staging-load.js");
      let failure;
      try {
        await execFileAsync(process.execPath, [scriptPath], {
          env: {
            ...process.env,
            STAGING_BASE_URL: `http://127.0.0.1:${port}`,
            STAGING_ACCESS_TOKEN: "must-not-be-sent",
            ALLOW_INSECURE_STAGING: "true",
            LOAD_ALLOW_SHORT_TEST: "true",
            LOAD_DURATION_SECONDS: "1",
            LOAD_CONCURRENCY: "1",
            LOAD_MAX_P95_MS: "1000",
            LOAD_MAX_P99_MS: "1500",
            LOAD_REQUEST_TIMEOUT_MS: "2000",
            LOAD_REQUIRE_RELEASE_SHA: "true",
            RELEASE_SHA: "expected-release",
          },
          timeout: 15000,
        });
      } catch (error) {
        failure = error;
      }
      expect(failure?.code).toBe(1);
      const evidence = JSON.parse(failure.stdout);
      expect(evidence.trafficStarted).toBe(false);
      expect(evidence.preflight.passed).toBe(false);
      expect(evidence.results).toEqual([]);
      expect(failure.stdout).not.toContain("must-not-be-sent");
      expect(authorizedRequests).toBe(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
