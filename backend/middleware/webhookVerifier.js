const crypto = require("crypto");

/**
 * Middleware xác thực Webhook từ SePay (hoặc cổng thanh toán ngân hàng)
 * 
 * Hỗ trợ các chuẩn xác thực của SePay:
 * 1. HMAC-SHA256 Signature (Khóa bí mật dạng whsec_...):
 *    - SePay gửi chữ ký qua header: `x-sepay-signature`, `x-signature`, hoặc `signature`
 * 2. API Key Header:
 *    - SePay gửi qua: `Authorization: Apikey <KEY>` hoặc `Authorization: Bearer <KEY>`
 */
const verifySepayWebhook = (req, res, next) => {
  try {
    const secretKey =
      process.env.SEPAY_WEBHOOK_SECRET || process.env.SEPAY_API_KEY;

    // Nếu chưa cấu hình secret:
    // - Ở Production: chặn lại để đảm bảo an toàn tuyệt đối
    // - Ở Development: cảnh báo nhưng cho qua để tiện test nội bộ
    if (!secretKey) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[Webhook Security] LỖI: Chưa cấu hình SEPAY_WEBHOOK_SECRET hoặc SEPAY_API_KEY trên Render Production!"
        );
        return res.status(500).json({
          success: false,
          message: "Webhook security credentials not configured on server",
        });
      }

      console.warn(
        "[Webhook Security Cảnh báo] Chưa cấu hình SEPAY_WEBHOOK_SECRET trong .env. Bỏ qua xác thực ở môi trường Dev."
      );
      return next();
    }

    const trimmedSecret = secretKey.trim();

    // 1. KIỂM TRA CHỮ KÝ HMAC-SHA256 (Header x-sepay-signature / x-signature / signature)
    const signature =
      req.headers["x-sepay-signature"] ||
      req.headers["x-signature"] ||
      req.headers["sepay-signature"] ||
      req.headers["signature"];

    if (signature) {
      const rawBody =
        typeof req.rawBody === "string" && req.rawBody.length > 0
          ? req.rawBody
          : JSON.stringify(req.body);

      const computedSig = crypto
        .createHmac("sha256", trimmedSecret)
        .update(rawBody)
        .digest("hex");

      const expectedBuffer = Buffer.from(computedSig, "utf8");
      const receivedBuffer = Buffer.from(signature.trim(), "utf8");

      if (
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        return next();
      }

      // Fallback: thử tính với JSON.stringify(req.body) nếu rawBody khác biệt do định dạng
      const fallbackSig = crypto
        .createHmac("sha256", trimmedSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      const fallbackBuffer = Buffer.from(fallbackSig, "utf8");
      if (
        fallbackBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(fallbackBuffer, receivedBuffer)
      ) {
        return next();
      }

      console.warn("[Webhook Security] Chữ ký HMAC-SHA256 SePay không hợp lệ!");
      return res.status(401).json({
        success: false,
        message: "Chữ ký xác thực Webhook HMAC-SHA256 không hợp lệ",
      });
    }

    // 2. KIỂM TRA QUA AUTHORIZATION HEADER (Nếu SePay truyền qua Authorization)
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      const receivedToken = authHeader
        .replace(/^(Apikey|Bearer)\s+/i, "")
        .trim();

      const tokenBuffer = Buffer.from(receivedToken, "utf8");
      const secretBuffer = Buffer.from(trimmedSecret, "utf8");

      // So khớp trực tiếp token với secretKey
      if (
        tokenBuffer.length === secretBuffer.length &&
        crypto.timingSafeEqual(tokenBuffer, secretBuffer)
      ) {
        return next();
      }

      // Hoặc nếu SePay truyền chữ ký HMAC trong Authorization header
      const computedSig = crypto
        .createHmac("sha256", trimmedSecret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest("hex");
      const computedBuffer = Buffer.from(computedSig, "utf8");

      if (
        tokenBuffer.length === computedBuffer.length &&
        crypto.timingSafeEqual(tokenBuffer, computedBuffer)
      ) {
        return next();
      }

      console.warn("[Webhook Security] Mã Authorization SePay không khớp!");
      return res.status(401).json({
        success: false,
        message: "Mã Authorization Webhook không hợp lệ",
      });
    }

    // Nếu không có bất kỳ header xác thực nào
    console.warn("[Webhook Security] Request thiếu chữ ký HMAC hoặc Authorization header!");
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

module.exports = { verifySepayWebhook };
