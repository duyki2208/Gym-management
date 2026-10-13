const { validateEnvironment } = require("../config/validateEnv");

const validProductionEnv = () => ({
  NODE_ENV: "production",
  MONGO_URI: "mongodb://database.example/gym",
  JWT_SECRET: "j".repeat(32),
  JWT_REFRESH_SECRET: "r".repeat(32),
  FACILITY_LOOKUP_PEPPER: "p".repeat(32),
  INTERNAL_SERVICE_SECRET: "i".repeat(32),
  SEPAY_WEBHOOK_SECRET: "s".repeat(24),
  ALLOWED_ORIGINS: "https://gym.example",
});

describe("production environment validation", () => {
  test("accepts a complete production configuration", () => {
    expect(validateEnvironment(validProductionEnv())).toEqual({
      valid: true,
      checked: true,
    });
  });

  test("fails closed when a required secret is missing", () => {
    const env = validProductionEnv();
    delete env.JWT_REFRESH_SECRET;

    expect(() => validateEnvironment(env)).toThrow(
      "JWT_REFRESH_SECRET is required"
    );
  });

  test("rejects weak secrets and wildcard CORS without exposing values", () => {
    const env = validProductionEnv();
    env.JWT_SECRET = "recognizable-short-value";
    env.ALLOWED_ORIGINS = "*";

    let message = "";
    try {
      validateEnvironment(env);
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("JWT_SECRET must contain at least 32 characters");
    expect(message).toContain("ALLOWED_ORIGINS must not contain a wildcard");
    expect(message).not.toContain(env.JWT_SECRET);
  });

  test("does not block local development or tests", () => {
    expect(validateEnvironment({ NODE_ENV: "test" })).toEqual({
      valid: true,
      checked: false,
    });
  });

  test("requires Redis URL when shared cache is mandatory", () => {
    const env = validProductionEnv();
    env.CACHE_REQUIRE_REDIS = "true";
    expect(() => validateEnvironment(env)).toThrow(
      "REDIS_URL is required when CACHE_REQUIRE_REDIS=true"
    );
  });
});
