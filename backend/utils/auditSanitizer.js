const { maskPhone } = require("./logger");

const FILTERED = "[FILTERED]";
const sensitiveKey = (key) => /password|secret|token|apikey|privatekey|credential|authorization|cookie|facilitykey|faceembedding|facedescriptor|biometric|base64|avatar|camerartsp|accountno|accountnumber|accountname|identitycard|healthnote|connectionstring|mongouri/.test(key.replace(/[^a-z0-9]/gi, "").toLowerCase());

const sanitizeText = (text) => text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi, (url) => {
  try {
    const parsed = new URL(url);
    if (["rtsp:", "rtsps:"].includes(parsed.protocol)) return FILTERED;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch { return FILTERED; }
});

// Always return a detached, bounded JSON-compatible value; never change req.body.
const sanitizeAuditValue = (value) => {
  const seen = new WeakSet();
  let visited = 0;
  const visit = (item, depth = 0) => {
    if (++visited > 5000 || depth > 20) return "[TRUNCATED]";
    if (typeof item === "string") return sanitizeText(item).slice(0, 4000);
    if (!item || typeof item !== "object") return item;
    if (item instanceof Date) return item.toISOString();
    if (typeof item.toHexString === "function") return item.toHexString();
    if (Buffer.isBuffer(item)) return FILTERED;
    if (seen.has(item)) return "[Circular]";
    seen.add(item);
    if (Array.isArray(item)) return item.slice(0, 500).map((entry) => visit(entry, depth + 1));
    return Object.fromEntries(Object.entries(item).slice(0, 500).map(([key, nested]) => [
      key,
      sensitiveKey(key) ? FILTERED : /phone|mobile|hotline/i.test(key)
        ? (typeof nested === "string" && /^\d{3}\*+\d{3}$/.test(nested) ? nested : maskPhone(nested))
        : visit(nested, depth + 1),
    ]));
  };
  return visit(value);
};

const auditPath = (value) => typeof value === "string" ? sanitizeText(value.split(/[?#]/, 1)[0]) : value;
const auditAction = (value) => typeof value === "string"
  ? (/^(?:POST|PUT|PATCH|DELETE|GET|SYSTEM)\s+\//.test(value) ? auditPath(value) : sanitizeText(value)) : value;
const sanitizeAuditRecord = (record) => {
  const value = typeof record?.toObject === "function" ? record.toObject() : record;
  return sanitizeAuditValue({ ...value, path: auditPath(value?.path), action: auditAction(value?.action) });
};

module.exports = { sanitizeAuditValue, sanitizeAuditRecord, auditPath, auditAction };
