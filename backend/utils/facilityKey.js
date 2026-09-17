const crypto = require("crypto");

const FACILITY_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

const normalizeFacilityKey = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();

const assertValidFacilityKey = (value) => {
  const normalized = normalizeFacilityKey(value);
  if (!FACILITY_KEY_PATTERN.test(normalized)) {
    throw new Error("FACILITY_KEY_INVALID");
  }
  return normalized;
};

const getFacilityLookupPepper = () => {
  const dedicatedPepper = process.env.FACILITY_LOOKUP_PEPPER;
  if (dedicatedPepper) {
    if (dedicatedPepper.length < 32) {
      throw new Error("FACILITY_LOOKUP_PEPPER must contain at least 32 characters");
    }
    return dedicatedPepper;
  }

  // Giữ hệ thống hiện tại hoạt động mà không ghi thêm secret vào source/.env.
  // Domain separation tạo khóa riêng cho facility lookup từ refresh-token secret.
  const rootSecret = process.env.JWT_REFRESH_SECRET;
  if (!rootSecret || rootSecret.length < 32) {
    throw new Error(
      "FACILITY_LOOKUP_PEPPER or JWT_REFRESH_SECRET must contain at least 32 characters"
    );
  }
  return crypto
    .createHmac("sha256", rootSecret)
    .update("gympro:facility-lookup:v1", "utf8")
    .digest();
};

const hashFacilityKey = (value) => {
  const normalized = assertValidFacilityKey(value);
  return crypto
    .createHmac("sha256", getFacilityLookupPepper())
    .update(normalized, "utf8")
    .digest("hex");
};

const getFacilityEncryptionKey = () =>
  crypto
    .createHmac("sha256", getFacilityLookupPepper())
    .update("gympro:facility-encryption:v1", "utf8")
    .digest();

const encryptFacilityKey = (value) => {
  const normalized = assertValidFacilityKey(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getFacilityEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);

  return {
    loginKeyCiphertext: ciphertext.toString("base64"),
    loginKeyIv: iv.toString("base64"),
    loginKeyAuthTag: cipher.getAuthTag().toString("base64"),
  };
};

const decryptFacilityKey = ({ loginKeyCiphertext, loginKeyIv, loginKeyAuthTag }) => {
  if (!loginKeyCiphertext || !loginKeyIv || !loginKeyAuthTag) return "";

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getFacilityEncryptionKey(),
    Buffer.from(loginKeyIv, "base64")
  );
  decipher.setAuthTag(Buffer.from(loginKeyAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(loginKeyCiphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = {
  FACILITY_KEY_PATTERN,
  normalizeFacilityKey,
  assertValidFacilityKey,
  hashFacilityKey,
  encryptFacilityKey,
  decryptFacilityKey,
};
