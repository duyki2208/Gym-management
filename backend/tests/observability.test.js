const request = require("supertest");
const app = require("../server");
const { buildReadiness } = require("../controllers/healthController");
const { maskPhone, redact } = require("../utils/logger");
const { shouldLogRequest } = require("../middleware/requestContext");
const { getReleaseSha } = require("../utils/releaseIdentity");

describe("observability and health probes", () => {
  test("liveness probe follows the standard response contract", async () => {
    const response = await request(app)
      .get("/api/v1/system/health/live")
      .set("x-request-id", "phase6-test-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("phase6-test-123");
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("live");
    expect(response.body.message).toBe("Service is live");
  });

  test("invalid incoming request id is replaced instead of reflected", async () => {
    const response = await request(app)
      .get("/api/v1/system/health/live")
      .set("x-request-id", "bad id");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).not.toBe("bad id");
    expect(response.headers["x-request-id"]).toMatch(
      /^[A-Za-z0-9._-]{8,128}$/
    );
  });

  test("readiness requires both operational databases", () => {
    expect(buildReadiness({ defaultState: 1, centralState: 1 })).toEqual({
      ready: true,
      dependencies: { defaultDatabase: true, centralDatabase: true, sharedCache: true, transactions: true },
    });
    expect(buildReadiness({ defaultState: 1, centralState: 0 }).ready).toBe(false);
  });

  test("readiness endpoint never exposes connection strings", async () => {
    const response = await request(app).get("/api/v1/system/health/ready");

    expect([200, 503]).toContain(response.status);
    expect(response.body.data.dependencies).toEqual({
      defaultDatabase: expect.any(Boolean),
      centralDatabase: expect.any(Boolean),
      sharedCache: expect.any(Boolean),
      transactions: expect.any(Boolean),
    });
    expect(JSON.stringify(response.body)).not.toContain("mongodb://");
  });

  test("readiness fails when a required shared cache is disconnected", () => {
    const result = buildReadiness({
      defaultState: 1,
      centralState: 1,
      cacheStatus: { redisRequired: true, redisConnected: false },
    });
    expect(result.ready).toBe(false);
    expect(result.dependencies.sharedCache).toBe(false);
  });

  test("readiness fails when transaction topology is required but unavailable", () => {
    const result = buildReadiness({
      defaultState: 1,
      centralState: 1,
      topologyStatus: { transactionRequired: true, transactionCapable: false },
    });
    expect(result.ready).toBe(false);
    expect(result.dependencies.transactions).toBe(false);
  });

  test("release identity uses an explicit override then Render deploy metadata", () => {
    expect(getReleaseSha({
      RELEASE_SHA: "manual-release",
      RENDER_GIT_COMMIT: "render-release",
      GITHUB_SHA: "github-release",
    })).toBe("manual-release");
    expect(getReleaseSha({ RENDER_GIT_COMMIT: "render-release" })).toBe("render-release");
    expect(getReleaseSha({ GITHUB_SHA: "github-release" })).toBe("github-release");
    expect(getReleaseSha({})).toBe("development");
  });

  test("structured logger recursively redacts sensitive metadata", () => {
    const safe = redact({
      requestId: "req-12345678",
      authorization: "Bearer private",
      nested: {
        password: "private",
        apiKey: "private",
        status: "ok",
      },
    });

    expect(safe).toEqual({
      requestId: "req-12345678",
      authorization: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        apiKey: "[REDACTED]",
        status: "ok",
      },
    });
  });

  test("logs mask phone numbers while keeping them traceable", () => {
    expect(maskPhone("0921982922")).toBe("092****922");
    expect(maskPhone("unknown")).toBe("[REDACTED]");
    expect(redact({ phone: "0921982922", nested: { customerPhone: "0987654321" } })).toEqual({
      phone: "092****922",
      nested: { customerPhone: "098****321" },
    });
  });

  test("compact HTTP logging hides preflight and fast successes but keeps slow/errors", () => {
    expect(shouldLogRequest({ method: "OPTIONS", statusCode: 204, durationMs: 2, mode: "all" })).toBe(false);
    expect(shouldLogRequest({ method: "GET", statusCode: 200, durationMs: 20, mode: "compact" })).toBe(false);
    expect(shouldLogRequest({ method: "GET", statusCode: 200, durationMs: 1200, mode: "compact" })).toBe(true);
    expect(shouldLogRequest({ method: "GET", statusCode: 500, durationMs: 20, mode: "compact" })).toBe(true);
  });
});
