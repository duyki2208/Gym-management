const crypto = require("crypto");

/**
 * Middleware xác thực Webhook từ SePay (hoặc cổng thanh toán ngân hàng)
 * 
 * Hỗ trợ các chuẩn xác thực của SePay:
 * 1. HMAC-SHA256 Signature (Chuẩn chính thức của SePay):
 *    - Header: `x-sepay-signature` (hoặc `X-SePay-Signature`): "sha256=<hex_hash>"
 *    - Header: `x-sepay-timestamp` (hoặc `X-SePay-Timestamp`): unix timestamp tính bằng giây
 *    - Dữ liệu ký: `${timestamp}.${rawBody}`
 * 2. API Key Header:
 *    - Header: `Authorization: Apikey <KEY>` hoặc `Authorization: Bearer <KEY>`
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

    // 1. KIỂM TRA CHỮ KÝ HMAC-SHA256 TỪ SEPAY
    const signatureHeader =
      req.headers["x-sepay-signature"] ||
      req.headers["x-signature"] ||
      req.headers["sepay-signature"] ||
      req.headers["signature"];

    if (signatureHeader) {
      // SePay gửi timestamp kèm theo trong header x-sepay-timestamp
      const timestamp =
        req.headers["x-sepay-timestamp"] ||
        req.headers["x-timestamp"] ||
        "";

      // Chuẩn hóa signature: bóc tách tiền tố "sha256=" nếu có
      const receivedHash = signatureHeader
        .replace(/^sha256=/i, "")
        .trim()
        .toLowerCase();

      const rawBody =
        typeof req.rawBody === "string" && req.rawBody.length > 0
          ? req.rawBody
          : JSON.stringify(req.body);

      // Thử các biến thể payload ký:
      // Chuẩn 1 của SePay: `${timestamp}.${rawBody}`
      // Chuẩn 2 (nếu không có timestamp): `${rawBody}`
      // Chuẩn 3: dùng JSON.stringify(req.body) phòng trường hợp rawBody bị can thiệp
      const payloadsToTry = [];
      if (timestamp) {
        payloadsToTry.push(`${timestamp}.${rawBody}`);
        payloadsToTry.push(`${timestamp}.${JSON.stringify(req.body)}`);
      }
      payloadsToTry.push(rawBody);
      payloadsToTry.push(JSON.stringify(req.body));

      for (const payload of payloadsToTry) {
        const computedHash = crypto
          .createHmac("sha256", trimmedSecret)
          .update(payload)
          .digest("hex")
          .toLowerCase();

        const expectedBuf = Buffer.from(computedHash, "utf8");
        const receivedBuf = Buffer.from(receivedHash, "utf8");

        if (
          expectedBuf.length === receivedBuf.length &&
          crypto.timingSafeEqual(expectedBuf, receivedBuf)
        ) {
          console.log("[Webhook Security] Xác thực chữ ký HMAC-SHA256 SePay THÀNH CÔNG!");
          return next();
        }
      }

      console.warn(
        `[Webhook Security CẢNH BÁO] Chữ ký HMAC SePay không hợp lệ! Header: "${signatureHeader}", Timestamp: "${timestamp}"`
      );
      return res.status(401).json({
        success: false,
        message: "Chữ ký xác thực Webhook HMAC-SHA256 không hợp lệ",
      });
    }

    // 2. KIỂM TRA QUA HEADER AUTHORIZATION (Nếu SePay cấu hình API Key)
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      const receivedToken = authHeader
        .replace(/^(Apikey|Bearer)\s+/i, "")
        .trim();

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

module.exports = { verifySepayWebhook };
