const crypto = require("crypto");

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const parseTimestampMilliseconds = (value) => {
  if (typeof value !== "string" || !/^\d{10}$/.test(value)) {
    return null;
  }

  const numericTimestamp = Number(value.trim());
  if (!Number.isSafeInteger(numericTimestamp)) return null;

  return numericTimestamp * 1000;
};

const getTimestampToleranceMilliseconds = () => {
  const configured = Number(process.env.SEPAY_WEBHOOK_TOLERANCE_SECONDS);
  const toleranceSeconds =
    Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;

  return toleranceSeconds * 1000;
};

/**
 * Middleware xác thực Webhook từ SePay (hoặc cổng thanh toán ngân hàng)
 * 
 * Hỗ trợ các chuẩn xác thực của SePay:
 * 1. HMAC-SHA256 Signature (Chuẩn chính thức của SePay):
 *    - Header: `x-sepay-signature` (hoặc `X-SePay-Signature`): "sha256=<hex_hash>"
 *    - Header: `x-sepay-timestamp` (hoặc `X-SePay-Timestamp`): unix timestamp tính bằng giây
 *    - Dữ liệu ký: `${timestamp}.${rawBody}`
 * 2. API Key Header:
 *    - Header: `Authorization: Apikey <KEY>`; chỉ khi AUTH_MODE=apikey.
 */
const verifySepayWebhook = (req, res, next) => {
  try {
    const mode = process.env.SEPAY_WEBHOOK_AUTH_MODE || "hmac";
    const secretKey = process.env.SEPAY_WEBHOOK_SECRET;
    if (!["hmac", "apikey"].includes(mode)) {
      return res.status(500).json({ success: false, code: "WEBHOOK_CONFIG_ERROR", message: "Webhook authentication mode is invalid" });
    }

    // Fail closed in every environment; tests must configure their own secret.
    if (!secretKey?.trim()) {
      return res.status(500).json({
        success: false,
        message: "Webhook security credentials not configured on server",
      });
    }

    const trimmedSecret = secretKey.trim();

    // 1. KIỂM TRA CHỮ KÝ HMAC-SHA256 TỪ SEPAY
    const signatureHeader = req.headers["x-sepay-signature"];

    if (mode === "hmac") {
      // SePay gửi timestamp kèm theo trong header x-sepay-timestamp
      const timestamp =
        req.headers["x-sepay-timestamp"] ||
        "";

      const timestampMilliseconds = parseTimestampMilliseconds(timestamp);
      if (timestampMilliseconds === null) {
        return res.status(401).json({
          success: false,
          message: "Webhook HMAC thiếu timestamp hợp lệ",
        });
      }

      if (
        Math.abs(Date.now() - timestampMilliseconds) >
        getTimestampToleranceMilliseconds()
      ) {
        return res.status(401).json({
          success: false,
          message: "Webhook HMAC đã hết thời hạn",
        });
      }

      // Chuẩn hóa signature: bóc tách tiền tố "sha256=" nếu có
      if (typeof signatureHeader !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(signatureHeader) ||
          typeof req.rawBody !== "string" || !req.rawBody.length) {
        return res.status(401).json({ success: false, message: "Webhook HMAC thiếu chữ ký hoặc raw body hợp lệ" });
      }
      const receivedHash = signatureHeader
        .replace(/^sha256=/i, "")
        .trim()
        .toLowerCase();

      const rawBody = req.rawBody;

      const computedHash = crypto
        .createHmac("sha256", trimmedSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

      const expectedBuf = Buffer.from(computedHash, "utf8");
      const receivedBuf = Buffer.from(receivedHash, "utf8");

      if (
        expectedBuf.length === receivedBuf.length &&
        crypto.timingSafeEqual(expectedBuf, receivedBuf)
      ) {
        return next();
      }
      console.warn(
        `[Webhook Security CẢNH BÁO] Chữ ký HMAC SePay không hợp lệ! Timestamp: "${timestamp}"`
      );
      return res.status(401).json({
        success: false,
        message: "Chữ ký xác thực Webhook HMAC-SHA256 không hợp lệ",
      });
    }

    // 2. KIỂM TRA QUA HEADER AUTHORIZATION (Nếu SePay cấu hình API Key)
    const authHeader = req.headers["authorization"];
    if (typeof authHeader === "string" && /^Apikey\s+\S+$/i.test(authHeader)) {
      const receivedToken = authHeader.replace(/^Apikey\s+/i, "");

      const tokenBuffer = Buffer.from(receivedToken, "utf8");
      const secretBuffer = Buffer.from(trimmedSecret, "utf8");

      if (
        tokenBuffer.length === secretBuffer.length &&
        crypto.timingSafeEqual(tokenBuffer, secretBuffer)
      ) {
        console.log("[Webhook Security] Xác thực API Key SePay THÀNH CÔNG!");
        return next();
      }

      console.warn("[Webhook Security] Mã Authorization SePay không khớp!");
      return res.status(401).json({
        success: false,
        message: "Mã Authorization Webhook không hợp lệ",
      });
    }

    console.warn(
      `[Webhook Security] Request thiếu thông tin xác thực! Headers có mặt: ${Object.keys(
        req.headers
      ).join(", ")}`
    );
    return res.status(401).json({
      success: false,
      message: "Thiếu thông tin xác thực webhook từ SePay",
    });
  } catch (error) {
    console.error("[Webhook Security Error]", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xác thực Webhook",
      error: error.message,
    });
  }
};

module.exports = {
  verifySepayWebhook,
  parseTimestampMilliseconds,
  getTimestampToleranceMilliseconds,
};
