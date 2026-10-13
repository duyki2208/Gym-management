const mongoose = require("mongoose");
const { runWithOptionalTransaction } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");

const CUSTOMER_FIELDS = [
  "name",
  "phone",
  "dob",
  "gender",
  "address",
  "avatar",
  "avatarUrl",
  "email",
  "healthNote",
  "faceEmbedding",
  "packageNote",
  "identityCard",
  "emergencyContactName",
  "emergencyContactPhone",
  "referredBy",
  "source",
];

const PACKAGE_FIELDS = [
  "packageType",
  "startDate",
  "endDate",
  "price",
  "remainingSessions",
  "trainer",
  "assignedStaff",
  "hasLocker",
  "hasWater",
  "contractType",
  "paymentStatus",
  "paidAmount",
  "status",
  "packageNote",
  "contractCode",
];

class CustomerProfileMutationError extends Error {
  constructor(message, statusCode = 400, code = "CUSTOMER_PROFILE_MUTATION_FAILED") {
    super(message);
    this.name = "CustomerProfileMutationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const withSession = (query, session) => (session ? query.session(session) : query);
const saveWithSession = (document, session) =>
  document.save({ session: session || undefined });
const writeOptions = (session) => (session ? { session } : undefined);

const createOne = (Model, data, session) =>
  session
    ? Model.create([data], { session }).then(([document]) => document)
    : Model.create(data);

const parseOptionalDate = (value) => {
  if (!value || value === "Invalid Date") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseRequiredDate = (value, fieldLabel) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CustomerProfileMutationError(`${fieldLabel} không hợp lệ.`, 400, "INVALID_DATE");
  }
  return parsed;
};

const validateAssignedStaff = async ({ models, customerPackage, data, session }) => {
  const staffId = data.assignedStaff !== undefined
    ? data.assignedStaff
    : customerPackage.assignedStaff;
  const packageName = data.packageType !== undefined
    ? data.packageType
    : customerPackage.packageName;
  if (!staffId) return;

  const [staffUser, packageInfo] = await Promise.all([
    withSession(models.User.findById(staffId), session),
    withSession(models.Package.findOne({ name: packageName }), session),
  ]);
  if (!staffUser || !packageInfo) return;

  if (packageInfo.type === "session" && !["pt", "pm"].includes(staffUser.role)) {
    throw new CustomerProfileMutationError(
      "Gói theo buổi bắt buộc chọn nhân viên tư vấn có chức vụ PT hoặc PM!",
      400,
      "INVALID_ASSIGNED_STAFF_ROLE"
    );
  }
  if (packageInfo.type === "monthly" && !["sm", "sale"].includes(staffUser.role)) {
    throw new CustomerProfileMutationError(
      "Gói theo ngày bắt buộc chọn nhân viên tư vấn có chức vụ SM hoặc Sale!",
      400,
      "INVALID_ASSIGNED_STAFF_ROLE"
    );
  }
};

const applyCustomerUpdates = (customer, data) => {
  CUSTOMER_FIELDS.forEach((field) => {
    if (data[field] === undefined) return;
    if (field === "dob") {
      customer[field] = parseOptionalDate(data[field]);
    } else if (field === "referredBy" && data[field] === "") {
      customer[field] = null;
    } else {
      customer[field] = data[field];
    }
  });
};

const resolvePaidAmount = (customerPackage, data) => {
  const status = data.paymentStatus !== undefined
    ? data.paymentStatus
    : customerPackage.paymentStatus;
  const price = data.price !== undefined ? Number(data.price) : Number(customerPackage.price);
  let paidAmount = data.paidAmount !== undefined
    ? Number(data.paidAmount)
    : Number(customerPackage.paidAmount);

  if (status === "paid") paidAmount = price;
  if (status === "unpaid") paidAmount = 0;
  if (status === "deposit" && (paidAmount <= 0 || paidAmount >= price)) {
    throw new CustomerProfileMutationError("Số tiền cọc không hợp lệ", 400, "INVALID_DEPOSIT");
  }
  return paidAmount;
};

const applyPackageUpdates = (customerPackage, data) => {
  PACKAGE_FIELDS.forEach((field) => {
    if (data[field] === undefined) return;
    if (field === "packageType") {
      customerPackage.packageName = data[field];
    } else if (field === "startDate" || field === "endDate") {
      customerPackage[field] = parseRequiredDate(
        data[field],
        field === "startDate" ? "Ngày bắt đầu" : "Ngày kết thúc"
      );
    } else if ((field === "trainer" || field === "assignedStaff") && data[field] === "") {
      customerPackage[field] = null;
    } else {
      customerPackage[field] = data[field];
    }
  });
};

const syncTransaction = async ({ models, customer, customerPackage, actorId, session }) => {
  let transaction = await withSession(
    models.Transaction.findOne({ customerPackage: customerPackage._id }),
    session
  );
  const paymentMethod = customerPackage.paymentStatus === "paid"
    ? "Tiền mặt"
    : "Chuyển khoản QR";
  if (transaction) {
    transaction.amount = customerPackage.paidAmount || 0;
    transaction.paymentMethod = paymentMethod;
    transaction.customerName = customer.name;
    await saveWithSession(transaction, session);
    return;
  }
  await createOne(models.Transaction, {
    type: "package_purchase",
    amount: customerPackage.paidAmount || 0,
    paymentMethod,
    customer: customer._id,
    customerName: customer.name,
    customerPackage: customerPackage._id,
    status: "success",
    staff: actorId,
    createdAt: customerPackage.createdAt || new Date(),
  }, session);
};

const syncCommissions = async ({ models, customerPackage, data, actorId, session }) => {
  if (data.assignedStaff !== undefined) {
    if (customerPackage.assignedStaff) {
      await models.Commission.updateMany(
        { customerPackage: customerPackage._id },
        { staff: customerPackage.assignedStaff },
        writeOptions(session)
      );
    } else {
      await models.Commission.updateMany(
        { customerPackage: customerPackage._id, status: "active" },
        {
          status: "revoked",
          revokedReason: "Thay đổi nhân viên tư vấn thành trống",
          revokedAt: new Date(),
          revokedBy: actorId,
        },
        writeOptions(session)
      );
    }
  }

  if (data.price === undefined && data.contractType === undefined) return;
  const commissions = await withSession(
    models.Commission.find({ customerPackage: customerPackage._id, status: "active" }),
    session
  );
  for (const commission of commissions) {
    commission.baseAmount = customerPackage.price || 0;
    commission.amount = commission.baseAmount * (commission.rate / 100);
    if (data.contractType !== undefined) commission.contractType = customerPackage.contractType;
    await saveWithSession(commission, session);
  }
};

const syncInvoice = async ({ models, customer, customerPackage, actorId, session }) => {
  let invoice = await withSession(
    models.Invoice.findOne({ referenceId: customerPackage._id }),
    session
  );
  const paymentMethod = customerPackage.paymentStatus === "paid"
    ? "Tiền mặt"
    : "Chuyển khoản QR";
  if (!invoice) {
    await createOne(models.Invoice, {
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: "package",
      referenceId: customerPackage._id,
      items: [{
        name: customerPackage.packageName,
        quantity: 1,
        price: customerPackage.price || 0,
        total: customerPackage.price || 0,
      }],
      subtotal: customerPackage.price || 0,
      total: customerPackage.price || 0,
      paymentMethod,
      paymentStatus: customerPackage.paymentStatus,
      staff: actorId,
    }, session);
    return;
  }

  invoice.customerName = customer.name;
  invoice.customerPhone = customer.phone;
  invoice.paymentStatus = customerPackage.paymentStatus;
  invoice.paymentMethod = paymentMethod;
  invoice.subtotal = customerPackage.price || 0;
  invoice.total = customerPackage.price || 0;
  if (invoice.items?.length > 0) {
    invoice.items[0].name = customerPackage.packageName;
    invoice.items[0].price = customerPackage.price || 0;
    invoice.items[0].total = customerPackage.price || 0;
  }
  await saveWithSession(invoice, session);
};

const updateCustomerProfile = async ({ models, packageId, data = {}, actorId }) => {
  const result = await runWithOptionalTransaction(
    models.connection || mongoose.connection,
    async (session) => {
      const customerPackage = await withSession(models.CustomerPackage.findById(packageId), session);
      if (!customerPackage) {
        throw new CustomerProfileMutationError(
          "Không tìm thấy gói tập của hội viên",
          404,
          "CUSTOMER_PACKAGE_NOT_FOUND"
        );
      }
      const customer = await withSession(models.Customer.findById(customerPackage.customer), session);
      if (!customer) {
        throw new CustomerProfileMutationError(
          "Không tìm thấy hồ sơ hội viên",
          404,
          "CUSTOMER_NOT_FOUND"
        );
      }

      await validateAssignedStaff({ models, customerPackage, data, session });
      const normalizedData = { ...data, paidAmount: resolvePaidAmount(customerPackage, data) };
      applyCustomerUpdates(customer, normalizedData);
      applyPackageUpdates(customerPackage, normalizedData);
      await saveWithSession(customer, session);
      await saveWithSession(customerPackage, session);
      await syncTransaction({ models, customer, customerPackage, actorId, session });
      await syncCommissions({ models, customerPackage, data: normalizedData, actorId, session });
      await syncInvoice({ models, customer, customerPackage, actorId, session });
      await syncCustomerFields(customer._id, { session }, models);
      return { packageId: customerPackage._id };
    }
  );

  return models.CustomerPackage.findById(result.packageId)
    .populate({
      path: "customer",
      populate: { path: "referredBy", select: "name code phone" },
    })
    .populate("assignedStaff", "fullName role")
    .populate("trainer", "fullName username role");
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const revokeReferralReward = async ({ models, customer, customerPackage, session }) => {
  if (
    !customer?.referredBy ||
    customer.source !== "referral" ||
    customerPackage.contractType !== "new"
  ) return;

  const rewardNote = `+1T giới thiệu HV(${customer.code})`;
  const referrerPackage = await withSession(models.CustomerPackage.findOne({
    customer: customer.referredBy,
    packageNote: { $regex: new RegExp(escapeRegex(rewardNote), "i") },
  }), session);
  if (!referrerPackage) return;

  const newEndDate = new Date(referrerPackage.endDate);
  newEndDate.setDate(newEndDate.getDate() - 30);
  referrerPackage.endDate = newEndDate;
  referrerPackage.packageNote = (referrerPackage.packageNote || "")
    .split("\n")
    .filter((line) => !line.toLowerCase().includes(rewardNote.toLowerCase()))
    .join("\n")
    .trim();
  await saveWithSession(referrerPackage, session);
  await syncCustomerFields(customer.referredBy, { session }, models);
};

const buildDeletedCustomerDetails = (customerPackage, customer) => ({
  package: {
    _id: customerPackage._id,
    packageName: customerPackage.packageName,
    startDate: customerPackage.startDate,
    endDate: customerPackage.endDate,
    price: customerPackage.price,
    contractCode: customerPackage.contractCode,
    packageNote: customerPackage.packageNote,
    contractType: customerPackage.contractType,
    paymentStatus: customerPackage.paymentStatus,
    paidAmount: customerPackage.paidAmount,
  },
  ...(customer ? {
    customer: {
      _id: customer._id,
      name: customer.name,
      code: customer.code,
      phone: customer.phone,
      email: customer.email,
      dob: customer.dob,
      gender: customer.gender,
      address: customer.address,
      identityCard: customer.identityCard,
      referredBy: customer.referredBy,
      source: customer.source,
    },
  } : {}),
});

const deleteCustomerPackage = async ({ models, packageId, actorId }) =>
  runWithOptionalTransaction(models.connection || mongoose.connection, async (session) => {
    const customerPackage = await withSession(models.CustomerPackage.findById(packageId), session);
    if (!customerPackage) {
      throw new CustomerProfileMutationError(
        "Không tìm thấy gói tập cần xóa",
        404,
        "CUSTOMER_PACKAGE_NOT_FOUND"
      );
    }

    const createdAt = new Date(customerPackage.createdAt);
    const lockedPeriod = await withSession(models.CommissionPeriod.findOne({
      month: createdAt.getMonth() + 1,
      year: createdAt.getFullYear(),
      type: "sale",
      status: { $in: ["approved", "paid"] },
    }), session);
    if (lockedPeriod) {
      throw new CustomerProfileMutationError(
        "Kỳ thanh toán hoa hồng Sale của gói tập này đã được duyệt hoặc chi trả, không thể xóa.",
        400,
        "COMMISSION_PERIOD_LOCKED"
      );
    }

    await models.Commission.updateMany(
      { customerPackage: customerPackage._id, status: "active" },
      {
        status: "revoked",
        revokedReason: "Xóa hợp đồng / gói tập",
        revokedAt: new Date(),
        revokedBy: actorId,
      },
      writeOptions(session)
    );
    const customer = await withSession(models.Customer.findById(customerPackage.customer), session);
    await revokeReferralReward({ models, customer, customerPackage, session });
    const deletedCustomerDetails = buildDeletedCustomerDetails(customerPackage, customer);

    customerPackage.isDeleted = true;
    await saveWithSession(customerPackage, session);
    await models.Transaction.updateMany(
      { customerPackage: customerPackage._id },
      { status: "failed" },
      writeOptions(session)
    );

    const remainingPackagesCount = await withSession(models.CustomerPackage.countDocuments({
      customer: customerPackage.customer,
      isDeleted: { $ne: true },
    }), session);
    if (remainingPackagesCount === 0 && customer) {
      customer.isDeleted = true;
      await saveWithSession(customer, session);
    } else if (customer) {
      await syncCustomerFields(customer._id, { session }, models);
    }
    return { deletedCustomerDetails };
  });

module.exports = {
  CustomerProfileMutationError,
  updateCustomerProfile,
  deleteCustomerPackage,
};
