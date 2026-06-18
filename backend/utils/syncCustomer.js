const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");

/**
 * Đồng bộ các field cached từ CustomerPackage (gói active nhất) vào Customer.
 * Hàm này được gọi sau mỗi thao tác create/update/freeze/unfreeze/cron để giữ
 * 2 collection nhất quán.
 *
 * @param {mongoose.Types.ObjectId|string} customerId
 */
async function syncCustomerFields(customerId) {
  try {
    // Ưu tiên gói đang active, nếu không có thì lấy gói mới nhất
    let activePackage = await CustomerPackage.findOne({
      customer: customerId,
      status: "active",
    }).sort({ endDate: -1 });

    if (!activePackage) {
      activePackage = await CustomerPackage.findOne({ customer: customerId }).sort({
        createdAt: -1,
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return;

    if (activePackage) {
      customer.activePackage   = activePackage._id;
      customer.packageType     = activePackage.packageName;
      customer.startDate       = activePackage.startDate;
      customer.endDate         = activePackage.endDate;
      customer.remainingSessions = activePackage.remainingSessions;
      customer.price           = activePackage.price;
      customer.paymentStatus   = activePackage.paymentStatus;
      customer.paidAmount      = activePackage.paidAmount;
      customer.contractType    = activePackage.contractType;
      customer.trainer         = activePackage.trainer;
      customer.assignedStaff   = activePackage.assignedStaff;
      customer.hasLocker       = activePackage.hasLocker;
      customer.hasWater        = activePackage.hasWater;
      customer.packageNote     = activePackage.packageNote;
      customer.contractCode    = activePackage.contractCode || "";
    } else {
      customer.activePackage   = null;
      customer.packageType     = "Không có";
      customer.startDate       = new Date();
      customer.endDate         = new Date();
      customer.remainingSessions = 0;
      customer.price           = 0;
      customer.paymentStatus   = "unpaid";
      customer.paidAmount      = 0;
      customer.packageNote     = "";
    }

    await customer.save();
  } catch (err) {
    console.error("Lỗi đồng bộ hồ sơ khách hàng:", err);
    throw err; // Re-throw để caller biết sync thất bại
  }
}

module.exports = syncCustomerFields;
