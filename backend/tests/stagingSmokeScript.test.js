const { execFile } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

describe("staging smoke script", () => {
  test("covers login, health, customer, check-in, POS and report without leaking credentials", async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
      requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
      res.setHeader("content-type", "application/json");
      res.setHeader("x-request-id", req.headers["x-request-id"] || "missing");

      if (req.url === "/api/v1/auth/login" && req.method === "POST") {
        res.end(JSON.stringify({ token: "issued-staging-token", user: { role: "admin" } }));
        return;
      }
      if (req.url === "/" || req.url === "/customers") {
        res.setHeader("content-type", "text/html");
        res.end('<html><body><div id="root"></div><script src="/assets/app.js"></script></body></html>');
        return;
      }
      if (req.url === "/assets/app.js") {
        res.setHeader("content-type", "application/javascript");
        res.end(`const apiBase = "http://127.0.0.1:${server.address().port}/api/v1";`);
        return;
      }
      if (req.url === "/api/v1/system/health/live") {
        res.end(JSON.stringify({ data: { release: "test-release" } }));
        return;
      }
      if (req.url === "/api/v1/system/health/ready") {
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
      if (req.url.startsWith("/api/v1/customers") && !req.headers.authorization) {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "Authentication required" }));
        return;
      }
      if (req.headers.authorization === "Bearer issued-staging-token") {
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }

      res.statusCode = 401;
      res.end(JSON.stringify({ message: "Invalid token" }));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const scriptPath = path.resolve(__dirname, "../scripts/staging-smoke.js");
      const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          STAGING_BASE_URL: `http://127.0.0.1:${port}`,
          STAGING_ACCESS_TOKEN: "",
          STAGING_LOGIN_FACILITY_KEY: "FACILITY-TEST",
          STAGING_LOGIN_USERNAME: "smoke-user",
          STAGING_LOGIN_PASSWORD: "smoke-password",
          STAGING_FRONTEND_URL: `http://127.0.0.1:${port}`,
          STAGING_EXPECTED_API_BASE_URL: `http://127.0.0.1:${port}/api/v1`,
          SMOKE_REQUIRE_LOGIN_FLOW: "true",
          SMOKE_REQUIRE_FRONTEND_FLOW: "true",
          ALLOW_INSECURE_STAGING: "true",
          RELEASE_SHA: "test-release",
        },
        timeout: 15000,
      });

      expect(stderr).toBe("");
      const evidence = JSON.parse(stdout);
      expect(evidence.success).toBe(true);
      expect(evidence.authenticationMode).toBe("credentials");
      expect(evidence.preflightPassed).toBe(true);
      expect(evidence.loginFlowExecuted).toBe(true);
      expect(evidence.authenticatedChecksExecuted).toBe(true);
      expect(evidence.skippedChecks).toEqual([]);
      expect(evidence.results.map((item) => item.name)).toEqual([
        "frontend-root",
        "frontend-spa-fallback",
        "frontend-api-target",
        "liveness",
        "readiness",
        "anonymous-protection",
        "login",
        "auth-session",
        "customer-read",
        "checkin-read",
        "pos-read",
        "report-summary",
      ]);
      expect(stdout).not.toContain("smoke-user");
      expect(stdout).not.toContain("smoke-password");
      expect(stdout).not.toContain("issued-staging-token");
      expect(requests.find((request) => request.url === "/api/v1/reports/summary")?.authorization)
        .toBe("Bearer issued-staging-token");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("does not send credentials when the public release preflight fails", async () => {
    let loginRequests = 0;
    const server = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      res.setHeader("x-request-id", req.headers["x-request-id"] || "missing");
      if (req.url === "/api/v1/auth/login") loginRequests += 1;
      if (req.url === "/api/v1/customers?limit=1") {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "Authentication required" }));
        return;
      }
      res.end(JSON.stringify({ data: { release: "different-release", dependencies: {} } }));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const scriptPath = path.resolve(__dirname, "../scripts/staging-smoke.js");
      await expect(execFileAsync(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          STAGING_BASE_URL: `http://127.0.0.1:${port}`,
          STAGING_ACCESS_TOKEN: "",
          STAGING_LOGIN_FACILITY_KEY: "FACILITY-TEST",
          STAGING_LOGIN_USERNAME: "smoke-user",
          STAGING_LOGIN_PASSWORD: "smoke-password",
          SMOKE_REQUIRE_LOGIN_FLOW: "true",
          ALLOW_INSECURE_STAGING: "true",
          RELEASE_SHA: "expected-release",
        },
        timeout: 15000,
      })).rejects.toMatchObject({ code: 1 });
      expect(loginRequests).toBe(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
