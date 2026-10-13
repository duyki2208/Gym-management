const mongoose = require("mongoose");
const { runWithOptionalTransaction } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");

class CustomerRegistrationError extends Error {
  constructor(message, statusCode = 400, code = "CUSTOMER_REGISTRATION_FAILED", details) {
    super(message);
    this.name = "CustomerRegistrationError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const withSession = (query, session) => session ? query.session(session) : query;
const createOne = (Model, data, session) =>
  session
    ? Model.create([data], { session }).then(([document]) => document)
    : Model.create(data);

const normalizePayment = (data) => {
  const price = Number(data.price || 0);
  let paidAmount = Number(data.paidAmount || 0);
  const paymentStatus = data.paymentStatus || "paid";
  if (paymentStatus === "paid") paidAmount = price;
  if (paymentStatus === "unpaid") paidAmount = 0;
  if (paymentStatus === "deposit" && (paidAmount <= 0 || paidAmount >= price)) {
    throw new CustomerRegistrationError("Số tiền cọc không hợp lệ.");
  }
  return { price, paidAmount, paymentStatus };
};

const findExistingCustomer = async (Customer, data, session) => {
  let parsedDob = null;
  if (data.dob) {
    parsedDob = new Date(data.dob);
    if (Number.isNaN(parsedDob.getTime())) parsedDob = null;
  }
  const query = { name: data.name, phone: data.phone };
  query[parsedDob ? "dob" : "$or"] = parsedDob
    ? parsedDob
    : [{ dob: { $exists: false } }, { dob: null }];
  return {
    parsedDob,
    customer: await withSession(Customer.findOne(query), session),
  };
};

const ensureInvoice = async ({ models, customer, customerPackage, actorId, session }) => {
  let invoice = await withSession(
    models.Invoice.findOne({ type: "package", referenceId: customerPackage._id }),
    session
  );
  if (!invoice) {
    invoice = await createOne(models.Invoice, {
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: "package",
      referenceId: customerPackage._id,
      items: [{
        name: customerPackage.packageName,
        quantity: 1,
        price: customerPackage.price,
        total: customerPackage.price,
      }],
      subtotal: customerPackage.price,
      total: customerPackage.price,
      paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
      paymentStatus: customerPackage.paymentStatus,
      staff: actorId,
    }, session);
  }
  return invoice;
};

const ensureTransaction = async ({ models, customer, customerPackage, actorId, operationKey, session }) => {
  let transaction = await withSession(
    models.Transaction.findOne({ operationKey }),
    session
  );
  if (!transaction) {
    transaction = await createOne(models.Transaction, {
      type: "package_purchase",
      amount: customerPackage.paidAmount || 0,
      paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
      customer: customer._id,
      customerName: customer.name,
      customerPackage: customerPackage._id,
      status: "success",
      staff: actorId,
      operationKey,
    }, session);
  }
  return transaction;
};

const registerCustomer = async ({ models, data, actorId, idempotencyKey }) => {
  if (!data.name || !data.phone || !data.packageType || !data.endDate) {
    throw new CustomerRegistrationError(
      "Thiếu thông tin bắt buộc (Tên, SĐT, Gói tập, Ngày kết thúc)."
    );
  }
  const normalizedKey = String(idempotencyKey || "").trim();
  if (!normalizedKey || normalizedKey.length > 200) {
    throw new CustomerRegistrationError(
      "Idempotency-Key không hợp lệ.",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }
  const operationKey = `customer-registration:${normalizedKey}`;
  const payment = normalizePayment(data);

  const work = async (session) => {
    let customerPackage = await withSession(
      models.CustomerPackage.findOne({ operationKey }),
      session
    );
    const isReplay = Boolean(customerPackage);
    let customer;
    let isNewCustomer = false;
    let referralWarning = null;

    if (customerPackage) {
      customer = await withSession(
        models.Customer.findById(customerPackage.customer),
        session
      );
    } else {
      const operationCustomer = await withSession(
        models.Customer.findOne({ registrationOperationKey: operationKey }),
        session
      );
      const existing = operationCustomer
        ? { customer: operationCustomer, parsedDob: operationCustomer.dob }
        : await findExistingCustomer(models.Customer, data, session);
      customer = existing.customer;
      isNewCustomer = !customer;
      if (!customer) {
        customer = await createOne(models.Customer, {
          name: data.name,
          phone: data.phone,
          dob: existing.parsedDob || undefined,
          gender: data.gender,
          address: data.address,
          avatar: data.avatar,
          avatarUrl: data.avatarUrl || "",
          email: data.email,
          healthNote: data.healthNote,
          packageType: data.packageType,
          price: payment.price,
          packageNote: data.packageNote || "",
          endDate: new Date(data.endDate),
          identityCard: data.identityCard || "",
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactPhone: data.emergencyContactPhone || "",
          referredBy: data.referredBy || undefined,
          source: data.source || "other",
          registrationOperationKey: operationKey,
        }, session);
        isNewCustomer = true;
      } else if (!operationCustomer && (!data.contractType || data.contractType === "new")) {
        throw new CustomerRegistrationError(
          `Khách hàng "${customer.name}" (${customer.code}) đã tồn tại. Vui lòng chọn nguồn hợp đồng phù hợp.`,
          409,
          "CONTRACT_TYPE_MISMATCH",
          {
            customerInfo: {
              _id: customer._id,
              name: customer.name,
              code: customer.code,
              phone: customer.phone,
            },
            suggestion: ["renew", "upgrade"],
            isNewCustomer: false,
          }
        );
      } else {
        if (data.faceEmbedding?.length) customer.faceEmbedding = data.faceEmbedding;
        for (const field of ["email", "healthNote", "avatar", "avatarUrl", "referredBy", "source"]) {
          if (data[field]) customer[field] = data[field];
        }
        if (data.price) customer.price = data.price;
        await customer.save({ session: session || undefined });
      }

      const packageTemplate = await withSession(
        models.Package.findOne({ name: data.packageType }),
        session
      );
      if (data.assignedStaff && packageTemplate) {
        const staff = await withSession(models.User.findById(data.assignedStaff), session);
        if (staff && packageTemplate.type === "session" && !["pt", "pm"].includes(staff.role)) {
          throw new CustomerRegistrationError("Gói theo buổi bắt buộc chọn PT hoặc PM.");
        }
        if (staff && packageTemplate.type === "monthly" && !["sm", "sale"].includes(staff.role)) {
          throw new CustomerRegistrationError("Gói theo ngày bắt buộc chọn SM hoặc Sale.");
        }
      }

      customerPackage = await createOne(models.CustomerPackage, {
        customer: customer._id,
        package: packageTemplate?._id,
        packageName: data.packageType,
        category: packageTemplate?.category || "maintenance",
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: new Date(data.endDate),
        price: payment.price,
        contractCode: data.contractCode || "HĐ-CŨ",
        packageNote: data.packageNote || "",
        remainingSessions: data.remainingSessions || 0,
        trainer: data.trainer || null,
        assignedStaff: data.assignedStaff || undefined,
        hasLocker: Boolean(data.hasLocker),
        hasWater: Boolean(data.hasWater),
        contractType: data.contractType || "new",
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        status: "active",
        operationKey,
      }, session);

    }

    // Also runs on replay so standalone deployments repair a crash between
    // contract creation and referral reward persistence.
    if (data.referredBy && data.source === "referral") {
      const referrerPackage = await withSession(
        models.CustomerPackage.findOne({ customer: data.referredBy, status: "active" })
          .sort({ endDate: -1 }),
        session
      );
      if (!referrerPackage) {
        const referrer = await withSession(
          models.Customer.findById(data.referredBy).select("name code phone"),
          session
        );
        referralWarning = {
          code: "REFERRER_NO_ACTIVE_PACKAGE",
          message: `Hội viên giới thiệu "${referrer?.name || data.referredBy}" không có gói đang hoạt động.`,
          referrerId: data.referredBy,
          referrerName: referrer?.name || "",
          referrerCode: referrer?.code || "",
        };
      } else {
        const rewardNote = `+1T giới thiệu HV(${customer.code})`;
        const alreadyRewarded = String(referrerPackage.packageNote || "")
          .split("\n")
          .includes(rewardNote);
        if (!alreadyRewarded) {
          referrerPackage.endDate = new Date(
            referrerPackage.endDate.getTime() + 30 * 24 * 60 * 60 * 1000
          );
          referrerPackage.packageNote = referrerPackage.packageNote
            ? `${referrerPackage.packageNote}\n${rewardNote}`
            : rewardNote;
          await referrerPackage.save({ session: session || undefined });
          await syncCustomerFields(data.referredBy, { session }, models);
        }
      }
    }

    const invoice = await ensureInvoice({ models, customer, customerPackage, actorId, session });
    const transaction = await ensureTransaction({
      models,
      customer,
      customerPackage,
      actorId,
      operationKey,
      session,
    });
    await syncCustomerFields(customer._id, { session }, models);
    return {
      customer,
      customerPackage,
      invoice,
      transaction,
      operationKey,
      isNewCustomer,
      isReplay,
      referralWarning,
    };
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runWithOptionalTransaction(models.connection || mongoose.connection, work);
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
      const [existingPackage, existingCustomer] = await Promise.all([
        models.CustomerPackage.findOne({ operationKey }),
        models.Customer.findOne({ registrationOperationKey: operationKey }),
      ]);
      if (!existingPackage && !existingCustomer) throw error;
    }
  }
  throw new CustomerRegistrationError("Không thể hoàn tất đăng ký sau khi retry.", 409);
};

module.exports = { CustomerRegistrationError, registerCustomer };
