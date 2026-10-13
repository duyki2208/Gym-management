const DefaultCustomer = require("../models/Customer");
const DefaultCustomerPackage = require("../models/CustomerPackage");

const emptyCustomerProjection = () => ({
  activePackage: null,
  packageType: "Không có",
  packageCategory: "maintenance",
  startDate: new Date(),
  endDate: new Date(),
  remainingSessions: 0,
  price: 0,
  paymentStatus: "unpaid",
  paidAmount: 0,
  contractType: "new",
  trainer: null,
  assignedStaff: null,
  hasLocker: false,
  hasWater: false,
  packageNote: "",
  contractCode: "",
});

const buildCustomerProjection = (customerPackage) => {
  if (!customerPackage) return emptyCustomerProjection();

  const isTransferred = customerPackage.status === "transferred";
  return {
    activePackage: isTransferred ? null : customerPackage._id,
    packageType: customerPackage.packageName,
    packageCategory: customerPackage.category || "maintenance",
    startDate: customerPackage.startDate,
    endDate: isTransferred ? new Date() : customerPackage.endDate,
    remainingSessions: isTransferred
      ? 0
      : customerPackage.remainingSessions || 0,
    price: customerPackage.price || 0,
    paymentStatus: customerPackage.paymentStatus || "unpaid",
    paidAmount: customerPackage.paidAmount || 0,
    contractType: customerPackage.contractType || "new",
    trainer: isTransferred ? null : customerPackage.trainer || null,
    assignedStaff: customerPackage.assignedStaff || null,
    hasLocker: isTransferred ? false : Boolean(customerPackage.hasLocker),
    hasWater: isTransferred ? false : Boolean(customerPackage.hasWater),
    packageNote: customerPackage.packageNote || "",
    contractCode: customerPackage.contractCode || "",
  };
};

const applySession = (query, session) =>
  session ? query.session(session) : query;

const findCanonicalPackage = async (
  CustomerPackageModel,
  customerId,
  session
) => {
  const activePackage = await applySession(
    CustomerPackageModel.findOne({
      customer: customerId,
      status: "active",
      isDeleted: { $ne: true },
    }).sort({ endDate: -1, createdAt: -1 }),
    session
  );

  if (activePackage) return activePackage;

  return applySession(
    CustomerPackageModel.findOne({
      customer: customerId,
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 }),
    session
  );
};

/**
 * CustomerPackage là nguồn dữ liệu chuẩn; Customer chỉ lưu phép chiếu phục vụ đọc nhanh.
 */
async function syncCustomerFields(customerId, options = {}, models = null) {
  const session = options?.session || null;
  const CustomerModel = models?.Customer || DefaultCustomer;
  const CustomerPackageModel =
    models?.CustomerPackage || DefaultCustomerPackage;

  const canonicalPackage = await findCanonicalPackage(
    CustomerPackageModel,
    customerId,
    session
  );
  const customer = await applySession(
    CustomerModel.findById(customerId),
    session
  );
  if (!customer) return null;

  const projection = buildCustomerProjection(canonicalPackage);
  customer.set(projection);
  await customer.save({ session: session || undefined });

  return { customer, canonicalPackage, projection };
}

module.exports = syncCustomerFields;
module.exports.buildCustomerProjection = buildCustomerProjection;
module.exports.emptyCustomerProjection = emptyCustomerProjection;
module.exports.findCanonicalPackage = findCanonicalPackage;
