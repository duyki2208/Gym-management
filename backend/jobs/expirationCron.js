/**
 * backend/jobs/expirationCron.js
 * Quét hết hạn gói tập, hủy cọc và unfreeze tự động cho từng chi nhánh độc lập
 * Timezone: Asia/Ho_Chi_Minh
 */
const cron = require("node-cron");
const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const syncCustomerFields = require("../utils/syncCustomer");
const {
  sendExpirationReminderEmail,
  sendUnfreezeNotificationEmail,
} = require("../utils/emailService");
const { startOfDay, endOfDay, addDays } = require("date-fns");

const runExpirationAndCleanupForBranch = async (branchCode) => {
  console.log(`[ExpirationCron] Chạy kiểm tra hết hạn cho chi nhánh: ${branchCode}`);
  try {
    const models = await getBranchModels(branchCode);
    const now = new Date();

    // 1. Tự động chuyển các gói hết hạn sang trạng thái "expired"
    const expiredPackages = await models.CustomerPackage.find({
      status: "active",
      endDate: { $lt: now },
    });

    console.log(`[${branchCode}] Tìm thấy ${expiredPackages.length} gói quá hạn. Chuyển sang expired...`);

    for (const pkg of expiredPackages) {
      pkg.status = "expired";
      await pkg.save();
      await syncCustomerFields(pkg.customer, {}, models);
    }

    // 2. Tự động hủy các gói đặt cọc sau 1 tháng không hoàn tất thanh toán
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const unpaidDepositPackages = await models.CustomerPackage.find({
      status: "active",
      paymentStatus: "deposit",
      startDate: { $lt: oneMonthAgo },
    });

    for (const pkg of unpaidDepositPackages) {
      pkg.status = "expired";
      pkg.packageNote = pkg.packageNote
        ? `${pkg.packageNote} [Hủy tự động: Quá hạn cọc 1 tháng]`
        : "[Hủy tự động: Quá hạn cọc 1 tháng]";
      await pkg.save();
      await syncCustomerFields(pkg.customer, {}, models);
    }

    // 3. Kiểm tra các gói đang bảo lưu để tự động kích hoạt lại khi hết hạn bảo lưu
    const frozenPackages = await models.CustomerPackage.find({
      status: "frozen",
    }).populate("customer");

    for (const pkg of frozenPackages) {
      if (pkg.frozenPeriods && pkg.frozenPeriods.length > 0) {
        const activePeriod = pkg.frozenPeriods[pkg.frozenPeriods.length - 1];
        if (activePeriod && now >= activePeriod.endDate) {
          pkg.status = "active";
          await pkg.save();
          await syncCustomerFields(pkg.customer?._id, {}, models);

          if (pkg.customer && pkg.customer.email) {
            await sendUnfreezeNotificationEmail(
              pkg.customer.email,
              pkg.customer.name,
              pkg.packageName,
              pkg.endDate,
              activePeriod.endDate
            ).catch((err) => console.warn(`Lỗi gửi mail unfreeze: ${err.message}`));
          }
        }
      }
    }
  } catch (branchError) {
    console.error(`[ExpirationCron Error] Lỗi xử lý chi nhánh ${branchCode}: ${branchError.message}`);
  }
};

const runAllBranchesCleanup = async () => {
  try {
    const centralModels = await getCentralModels();
    const activeBranches = await centralModels.Branch.find({ isActive: true });

    for (const branch of activeBranches) {
      await runExpirationAndCleanupForBranch(branch.code);
    }
  } catch (error) {
    console.error(`[ExpirationCron Error] Lỗi quét danh sách chi nhánh: ${error.message}`);
  }
};

const startExpirationCron = () => {
  // Chạy ngay sau 5s khởi động
  setTimeout(() => {
    runAllBranchesCleanup().catch((err) => console.error("Lỗi chạy cleanup ban đầu:", err));
  }, 5000);

  // Lịch chạy hàng ngày lúc 08:00 sáng (giờ Việt Nam)
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[ExpirationCron] Bắt đầu chạy cron job hết hạn định kỳ hàng ngày...");
      try {
        const centralModels = await getCentralModels();
        const activeBranches = await centralModels.Branch.find({ isActive: true });

        const targetDate = addDays(new Date(), 14);
        const startOfTarget = startOfDay(targetDate);
        const endOfTarget = endOfDay(targetDate);

        for (const branch of activeBranches) {
          try {
            const models = await getBranchModels(branch.code);
            const expiringCustomers = await models.Customer.find({
              endDate: { $gte: startOfTarget, $lte: endOfTarget },
              email: { $ne: "" },
              $or: [{ email: { $exists: true } }],
            });

            for (const customer of expiringCustomers) {
              if (customer.email) {
                await sendExpirationReminderEmail(
                  customer.email,
                  customer.name,
                  customer.packageType,
                  customer.endDate
                ).catch((e) => console.warn(`Lỗi gửi email reminder: ${e.message}`));
              }
            }
          } catch (e) {
            console.error(`[ExpirationCron] Lỗi gửi reminder chi nhánh ${branch.code}: ${e.message}`);
          }
        }

        await runAllBranchesCleanup();
      } catch (error) {
        console.error("[ExpirationCron] Lỗi cron job:", error);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" }
  );

  console.log("[ExpirationCron] Đã lập lịch cron kiểm tra hết hạn đa chi nhánh (Asia/Ho_Chi_Minh).");
};

module.exports = startExpirationCron;
