const SECRET_MINIMUMS = {
  JWT_SECRET: 32,
  JWT_REFRESH_SECRET: 32,
  FACILITY_LOOKUP_PEPPER: 32,
  INTERNAL_SERVICE_SECRET: 32,
  SEPAY_WEBHOOK_SECRET: 24,
};

const REQUIRED_PRODUCTION_VARIABLES = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "FACILITY_LOOKUP_PEPPER",
  "INTERNAL_SERVICE_SECRET",
  "SEPAY_WEBHOOK_SECRET",
  "ALLOWED_ORIGINS",
];

const validateEnvironment = (env = process.env) => {
  if (env.NODE_ENV !== "production") {
    return { valid: true, checked: false };
  }

  const errors = [];
  for (const variable of REQUIRED_PRODUCTION_VARIABLES) {
    if (!String(env[variable] || "").trim()) {
      errors.push(`${variable} is required`);
    }
  }

  for (const [variable, minimum] of Object.entries(SECRET_MINIMUMS)) {
    const value = String(env[variable] || "");
    if (value && value.length < minimum) {
      errors.push(`${variable} must contain at least ${minimum} characters`);
    }
  }

  const origins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.includes("*")) {
    errors.push("ALLOWED_ORIGINS must not contain a wildcard in production");
  }

  if (String(env.CACHE_REQUIRE_REDIS || "").toLowerCase() === "true" && !env.REDIS_URL) {
    errors.push("REDIS_URL is required when CACHE_REQUIRE_REDIS=true");
  }

  if (errors.length) {
    throw new Error(`Invalid production environment: ${errors.join("; ")}`);
  }

  return { valid: true, checked: true };
};

module.exports = {
  REQUIRED_PRODUCTION_VARIABLES,
  SECRET_MINIMUMS,
  validateEnvironment,
};
