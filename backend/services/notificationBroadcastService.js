const { format } = require("date-fns");

const ALLOWED_AUDIENCES = new Set(["all", "active", "expiring_soon", "expired"]);
const ALLOWED_CHANNELS = new Set(["email", "zalo"]);

class NotificationBroadcastError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_NOTIFICATION_BROADCAST") {
    super(message);
    this.name = "NotificationBroadcastError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const normalizeChannels = (channels) => {
  const values = Array.isArray(channels)
    ? channels
    : typeof channels === "string"
      ? channels.split(",")
      : ["email"];
  const normalized = [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0 || normalized.some((channel) => !ALLOWED_CHANNELS.has(channel))) {
    throw new NotificationBroadcastError(
      "Kênh gửi chỉ hỗ trợ email hoặc zalo.",
      400,
      "INVALID_NOTIFICATION_CHANNEL"
    );
  }
  return normalized;
};

const buildAudienceQuery = ({ targetAudience = "all", now }) => {
  if (!ALLOWED_AUDIENCES.has(targetAudience)) {
    throw new NotificationBroadcastError(
      "Nhóm người nhận không hợp lệ.",
      400,
      "INVALID_TARGET_AUDIENCE"
    );
  }
  const query = { isDeleted: { $ne: true } };
  if (targetAudience === "active") {
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
  } else if (targetAudience === "expiring_soon") {
    query.startDate = { $lte: now };
    query.endDate = {
      $gte: now,
      $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };
  } else if (targetAudience === "expired") {
    query.endDate = { $lt: now };
  }
  return query;
};

const buildCustomRecipient = (value, now) => {
  const recipient = String(value || "").trim();
  if (!recipient) return null;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  const normalizedPhone = recipient.replace(/[\s.-]/g, "");
  const isPhone = /^\+?\d{9,15}$/.test(normalizedPhone);
  if (!isEmail && !isPhone) {
    throw new NotificationBroadcastError(
      "Email hoặc số điện thoại người nhận không hợp lệ.",
      400,
      "INVALID_CUSTOM_RECIPIENT"
    );
  }
  return {
    name: "Quý khách",
    email: isEmail ? recipient : "",
    phone: isPhone ? normalizedPhone : "",
    packageName: "Gói tập",
    endDate: now,
  };
};

const prepareManualBroadcast = async ({ Customer, Setting, data = {}, file, now = new Date() }) => {
  const subject = String(data.subject || "").trim();
  const body = String(data.body || "").trim();
  if (!subject || !body) {
    throw new NotificationBroadcastError(
      "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo",
      400,
      "MISSING_NOTIFICATION_CONTENT"
    );
  }
  const channels = normalizeChannels(data.channels);
  const customRecipient = buildCustomRecipient(data.customRecipient, now);
  const setting = await Setting.findOne().lean();
  const branchName = setting?.gymName || "Gym Fitness";
  let recipients;
  if (customRecipient) {
    recipients = [customRecipient];
  } else {
    const query = buildAudienceQuery({ targetAudience: data.targetAudience || "all", now });
    const customers = await Customer.find(query)
      .select("name email phone packageType endDate")
      .lean();
    recipients = customers.map((customer) => ({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      packageName: customer.packageType || "Gói tập",
      endDate: customer.endDate,
    }));
  }
  if (recipients.length === 0) {
    throw new NotificationBroadcastError(
      "Không tìm thấy hội viên nào phù hợp với nhóm đối tượng đã chọn",
      400,
      "NO_NOTIFICATION_RECIPIENTS"
    );
  }
  return {
    subject,
    body,
    channels,
    branchName,
    recipients,
    attachment: file ? {
      content: file.buffer.toString("base64"),
      name: file.originalname,
    } : null,
  };
};

const replaceTokens = (template, recipient, branchName) => String(template)
  .replace(/\{\{ten_khach_hang\}\}/gi, recipient.name)
  .replace(/\{\{ten_chi_nhanh\}\}/gi, branchName)
  .replace(/\{\{ten_goi_tap\}\}/gi, recipient.packageName)
  .replace(
    /\{\{ngay_het_han\}\}/gi,
    recipient.endDate ? format(new Date(recipient.endDate), "dd/MM/yyyy") : "Đang cập nhật"
  );

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const buildEmailHtml = ({ body, branchName }) => `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
    <div style="background: #059669; padding: 22px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 18px;">${escapeHtml(branchName)}</h2>
    </div>
    <div style="padding: 24px; line-height: 1.7; color: #334155; font-size: 14px; white-space: pre-line;">${escapeHtml(body)}</div>
    <div style="background-color: #f8fafc; padding: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
      Cảm ơn bạn đã đồng hành cùng ${escapeHtml(branchName)}!
    </div>
  </div>
`;

const dispatchManualBroadcast = async ({ broadcast, sendEmail, sendZalo, delayMs = 100 }) => {
  let sentEmail = 0;
  let sentZalo = 0;
  for (const recipient of broadcast.recipients) {
    const subject = replaceTokens(broadcast.subject, recipient, broadcast.branchName);
    const body = replaceTokens(broadcast.body, recipient, broadcast.branchName);
    if (broadcast.channels.includes("email") && recipient.email?.includes("@")) {
      try {
        await sendEmail({
          toEmail: recipient.email,
          toName: recipient.name,
          subject,
          htmlContent: buildEmailHtml({ body, branchName: broadcast.branchName }),
          attachments: broadcast.attachment ? [broadcast.attachment] : [],
        });
        sentEmail += 1;
      } catch (error) {
        console.error("Lỗi gửi email tay:", error.message);
      }
    }
    if (broadcast.channels.includes("zalo") && recipient.phone) {
      try {
        await sendZalo({ phone: recipient.phone, message: body, type: "manual_broadcast" });
        sentZalo += 1;
      } catch (error) {
        console.error("Lỗi gửi zalo tay:", error.message);
      }
    }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { sentEmail, sentZalo };
};

module.exports = {
  NotificationBroadcastError,
  buildAudienceQuery,
  normalizeChannels,
  prepareManualBroadcast,
  dispatchManualBroadcast,
};
