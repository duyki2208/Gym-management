const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|credential|faceembedding)/i;
const PHONE_KEY = /(phone|mobile|hotline)/i;

const maskPhone = (value) => {
  if (value === null || value === undefined || value === "") return value;

  const normalized = String(value).trim();
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7) return "[REDACTED]";

  const visiblePrefix = digits.slice(0, 3);
  const visibleSuffix = digits.slice(-3);
  return `${visiblePrefix}${"*".repeat(digits.length - 6)}${visibleSuffix}`;
};

const redact = (value, seen = new WeakSet()) => {
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : PHONE_KEY.test(key)
          ? maskPhone(nestedValue)
          : redact(nestedValue, seen),
    ])
  );
};

const write = (level, event, metadata = {}) => {
  const entry = {
    ...redact(metadata),
    timestamp: new Date().toISOString(),
    level,
    event,
  };
  const serialized = JSON.stringify(entry);
  if (level === "error" || level === "fatal") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
  return entry;
};

module.exports = {
  maskPhone,
  redact,
  info: (event, metadata) => write("info", event, metadata),
  warn: (event, metadata) => write("warn", event, metadata),
  error: (event, metadata) => write("error", event, metadata),
  fatal: (event, metadata) => write("fatal", event, metadata),
};
