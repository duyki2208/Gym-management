const DefaultCustomer = require("../models/Customer");
const DefaultCustomerPackage = require("../models/CustomerPackage");

/**
 * Đồng bộ các field cached từ CustomerPackage (gói active nhất) vào Customer.
 *
 * @param {mongoose.Types.ObjectId|string} customerId
 * @param {object} [options] - Tùy chọn truyền vào như { session }
 * @param {object} [models] - Branch models { Customer, CustomerPackage }
 */
async function syncCustomerFields(customerId, options = {}, models = null) {
  try {
    const session = options && options.session ? options.session : null;

    const CustomerModel = models?.Customer || DefaultCustomer;
    const CustomerPackageModel = models?.CustomerPackage || DefaultCustomerPackage;

    // Ưu tiên gói đang active, nếu không có thì lấy gói mới nhất
    let activePackageQuery = CustomerPackageModel.findOne({
      customer: customerId,
      status: "active",
      isDeleted: { $ne: true },
    }).sort({ endDate: -1 });

    if (session) {
      activePackageQuery = activePackageQuery.session(session);
    }
    let activePackage = await activePackageQuery;

    if (!activePackage) {
      let latestPackageQuery = CustomerPackageModel.findOne({
        customer: customerId,
        isDeleted: { $ne: true },
      }).sort({ createdAt: -1 });

      if (session) {
        latestPackageQuery = latestPackageQuery.session(session);
      }
      activePackage = await latestPackageQuery;
    }

    let customerQuery = CustomerModel.findById(customerId);
    if (session) {
      customerQuery = customerQuery.session(session);
    }
    const customer = await customerQuery;
    if (!customer) return;

    if (activePackage) {
      const isTransferred = activePackage.status === "transferred";
      customer.activePackage   = activePackage._id;
      customer.packageType     = activePackage.packageName;
      customer.startDate       = activePackage.startDate;
      customer.endDate         = isTransferred ? new Date() : activePackage.endDate;
      customer.remainingSessions = isTransferred ? 0 : (activePackage.remainingSessions || 0);
      customer.price           = activePackage.price;
      customer.paymentStatus   = activePackage.paymentStatus;
      customer.paidAmount      = activePackage.paidAmount;
      customer.contractType    = activePackage.contractType;
      customer.trainer         = isTransferred ? null : activePackage.trainer;
      customer.assignedStaff   = activePackage.assignedStaff;
      customer.hasLocker       = isTransferred ? false : activePackage.hasLocker;
      customer.hasWater        = isTransferred ? false : activePackage.hasWater;
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

    await customer.save({ session });
  } catch (err) {
    console.error("Lỗi đồng bộ hồ sơ khách hàng:", err);
    throw err;
  }
}

module.exports = syncCustomerFields;

