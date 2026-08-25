/**
 * backend/jobs/transferPendingWatcher.js
 * Cron job quét các giao dịch chuyển cơ sở đang bị kẹt (transfer_pending > 60 phút)
 * Timezone: Asia/Ho_Chi_Minh
 */
const cron = require("node-cron");
const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");

const scanStuckPendingTransfers = async () => {
  try {
    const centralModels = await getCentralModels();
    const activeBranches = await centralModels.Branch.find({ isActive: true });

    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const branch of activeBranches) {
      try {
        const branchModels = await getBranchModels(branch.code);
        const stuckPackages = await branchModels.CustomerPackage.find({
          transferStatus: "transfer_pending",
          updatedAt: { $lte: sixtyMinutesAgo },
        }).populate("customer", "name phone code");

        if (stuckPackages.length > 0) {
          console.warn(
            `[TransferWatcher CẢNH BÁO] Phát hiện ${stuckPackages.length} giao dịch chuyển cơ sở bị kẹt > 60 phút tại chi nhánh ${branch.code}:`
          );
          stuckPackages.forEach((pkg) => {
            console.warn(
              `  - Gói: ${pkg.packageName} (ID: ${pkg._id}) | Khách: ${pkg.customer?.name} (${pkg.customer?.phone}) | Đích: ${pkg.branchTransferredTo} | Thời gian cập nhật: ${pkg.updatedAt}`
            );
          });
        }
      } catch (branchErr) {
        console.error(`[TransferWatcher Error] Lỗi kiểm tra chi nhánh ${branch.code}: ${branchErr.message}`);
      }
    }
  } catch (error) {
    console.error(`[TransferWatcher Error] Lỗi quét transfer pending: ${error.message}`);
  }
};

const startTransferPendingWatcher = () => {
  // Chạy định kỳ mỗi 30 phút (giờ Việt Nam)
  cron.schedule(
    "*/30 * * * *",
    async () => {
      console.log("[TransferWatcher] Bắt đầu quét các hợp đồng chuyển cơ sở pending...");
      await scanStuckPendingTransfers();
    },
    { timezone: "Asia/Ho_Chi_Minh" }
  );

  console.log("[TransferWatcher] Đã kích hoạt Cron Job theo dõi chuyển nhượng chi nhánh (Asia/Ho_Chi_Minh).");
};

module.exports = {
  startTransferPendingWatcher,
  scanStuckPendingTransfers,
};
