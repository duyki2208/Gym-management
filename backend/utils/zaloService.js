const AuditLog = require("../models/AuditLog");
const { maskPhone } = require("./logger");

/**
 * Zalo OA Mock Service — Giả lập gửi tin nhắn chăm sóc khách hàng
 * @param {string} phone - Số điện thoại nhận
 * @param {string} message - Nội dung tin nhắn
 * @param {string} type - Loại tin nhắn (e.g. checkin, workout_deduction, package_purchase)
 */
const sendZaloNotification = async ({ phone, message, type }) => {
  try {
    const formattedPhone = phone ? phone.trim() : "Không rõ";
    const maskedPhone = maskPhone(formattedPhone);
    console.log(`\x1b[36m[ZALO OA MOCK] Gửi tin nhắn tới SĐT ${maskedPhone} [Loại: ${type}]: "${message}"\x1b[0m`);
    
    // Ghi nhận hành động vào Audit Log của hệ thống
    await AuditLog.create({
      username: "Zalo OA (Mock)",
      action: `Gửi tin nhắn Zalo OA tới ${maskedPhone} (${type})`,
      method: "SMS",
      path: "/zalo/send",
      details: { phone: maskedPhone, message, type, status: "sent", timestamp: new Date() }
    });
  } catch (err) {
    console.error("Lỗi gửi tin nhắn Zalo OA Mock:", err);
  }
};

module.exports = { sendZaloNotification };
