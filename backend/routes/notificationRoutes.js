const express = require("express");
const Customer = require("../models/Customer");
const TeamTask = require("../models/TeamTask");
const Product = require("../models/Product");
const Setting = require("../models/Setting");
const KPITarget = require("../models/KPITarget");
const CommissionPeriod = require("../models/CommissionPeriod");
const WorkoutSession = require("../models/WorkoutSession");
const Transaction = require("../models/Transaction");
const CustomerPackage = require("../models/CustomerPackage");
const { protect } = require("../middleware/authMiddleware");
const {
  PERMISSIONS,
  requirePermission,
  resolvePermissions,
} = require("../middleware/permissions");
const {
  DOCUMENT_UPLOAD_TYPES,
  createMemoryUpload,
  validateUploadedFile,
} = require("../middleware/secureUpload");
const { sendCustomEmailWithAttachment } = require("../utils/emailService");
const { sendZaloNotification } = require("../utils/zaloService");
const { buildNotificationFeed } = require("../services/notificationFeedService");
const {
  NotificationBroadcastError,
  prepareManualBroadcast,
  dispatchManualBroadcast,
} = require("../services/notificationBroadcastService");

const router = express.Router();
const upload = createMemoryUpload({
  maxBytes: 10 * 1024 * 1024,
  allowedTypes: DOCUMENT_UPLOAD_TYPES,
});

const getNotificationModels = (req) => ({
  ...(req.models || {}),
  Customer: req.models?.Customer || Customer,
  TeamTask: req.models?.TeamTask || TeamTask,
  Product: req.models?.Product || Product,
  Setting: req.models?.Setting || Setting,
  KPITarget: req.models?.KPITarget || KPITarget,
  CommissionPeriod: req.models?.CommissionPeriod || CommissionPeriod,
  WorkoutSession: req.models?.WorkoutSession || WorkoutSession,
  Transaction: req.models?.Transaction || Transaction,
  CustomerPackage: req.models?.CustomerPackage || CustomerPackage,
});

const resolveNotificationCapabilities = async (req) => {
  const permissions = await resolvePermissions(req);
  const has = (permission) => permissions.includes("*") || permissions.includes(permission);
  return {
    canReadCustomers: has(PERMISSIONS.CUSTOMER_READ),
    canReadTeamTasks: has(PERMISSIONS.TEAM_TASK_READ),
    canReadInventory: has(PERMISSIONS.INVENTORY_READ),
    canReadReports: has(PERMISSIONS.REPORT_READ_ALL),
    canReadCommissions: has(PERMISSIONS.COMMISSION_READ),
    canReadAllCommissions: has(PERMISSIONS.COMMISSION_READ_ALL),
  };
};

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  async (req, res) => {
    try {
      const capabilities = await resolveNotificationCapabilities(req);
      return res.json(await buildNotificationFeed({
        models: getNotificationModels(req),
        user: req.user,
        capabilities,
      }));
    } catch (error) {
      console.error("Lỗi lấy notifications:", error);
      return res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/send-manual",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_BROADCAST),
  upload.single("attachment"),
  validateUploadedFile(DOCUMENT_UPLOAD_TYPES),
  async (req, res) => {
    try {
      const models = getNotificationModels(req);
      const broadcast = await prepareManualBroadcast({
        Customer: models.Customer,
        Setting: models.Setting,
        data: req.body,
        file: req.file,
      });
      res.status(200).json({
        success: true,
        message: `Đang phát lệnh gửi thông báo tới ${broadcast.recipients.length} người nhận...`,
        data: { total: broadcast.recipients.length },
      });

      setImmediate(() => {
        dispatchManualBroadcast({
          broadcast,
          sendEmail: sendCustomEmailWithAttachment,
          sendZalo: sendZaloNotification,
        })
          .then(({ sentEmail, sentZalo }) => {
            console.log(`[Manual Notification] Hoàn tất phát tin: Email (${sentEmail}), Zalo (${sentZalo})`);
          })
          .catch((error) => {
            console.error("Lỗi chạy broadcast nền:", error);
          });
      });
      return undefined;
    } catch (error) {
      console.error("Lỗi send-manual:", error);
      return res.status(
        error instanceof NotificationBroadcastError ? error.statusCode : 500
      ).json({
        success: false,
        code: error.code,
        message: error.message || "Lỗi máy chủ khi gửi thông báo thủ công",
      });
    }
  }
);

module.exports = router;
