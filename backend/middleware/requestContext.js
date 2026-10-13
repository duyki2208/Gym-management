const { randomUUID } = require("node:crypto");
const logger = require("../utils/logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

const shouldLogRequest = ({ method, statusCode, durationMs, mode }) => {
  if (method === "OPTIONS" && process.env.HTTP_LOG_OPTIONS !== "true") return false;
  if (mode === "off") return false;
  if (mode === "errors") return statusCode >= 400;
  if (mode === "compact") {
    const slowThresholdMs = Math.max(0, Number(process.env.HTTP_SLOW_REQUEST_MS) || 1000);
    return statusCode >= 400 || durationMs >= slowThresholdMs;
  }
  return true;
};

const requestContext = (req, res, next) => {
  const incomingRequestId = String(req.get("x-request-id") || "");
  req.id = REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
  res.setHeader("X-Request-Id", req.id);

  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const mode = process.env.HTTP_LOG_MODE || (process.env.NODE_ENV === "production" ? "all" : "compact");
    if (!shouldLogRequest({ method: req.method, statusCode: res.statusCode, durationMs, mode })) return;
    logger.info("http_request_completed", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl?.split("?")[0] || req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      branchCode: req.branchCode || null,
    });
  });

  next();
};

module.exports = requestContext;
module.exports.REQUEST_ID_PATTERN = REQUEST_ID_PATTERN;
module.exports.shouldLogRequest = shouldLogRequest;
