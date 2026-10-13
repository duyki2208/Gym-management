const mongoose = require("mongoose");
const syncCustomerFields = require("../utils/syncCustomer");
const { runWithOptionalTransaction } = require("../utils/dbTransaction");

const DAY_MS = 24 * 60 * 60 * 1000;

class ContractLifecycleError extends Error {
  constructor(message, statusCode = 400, code = "CONTRACT_LIFECYCLE_FAILED") {
    super(message);
    this.name = "ContractLifecycleError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const withSession = (query, session) =>
  session ? query.session(session) : query;

const createWithSession = (Model, document, session) =>
  session ? Model.create([document], { session }).then(([item]) => item) : Model.create(document);

const parseDate = (value, message) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ContractLifecycleError(message);
  }
  return date;
};

const sameInstant = (left, right) =>
  left && right && new Date(left).getTime() === new Date(right).getTime();

const freezeContract = async ({ models, packageId, data, actorId }) => {
  const { Customer, CustomerPackage, Transaction } = models;
  if (!data.startDate || !data.endDate) {
    throw new ContractLifecycleError(
      "Vui lòng cung cấp đầy đủ ngày bắt đầu và ngày kết thúc bảo lưu."
    );
  }
  const start = parseDate(
    data.startDate,
    "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ."
  );
  const end = parseDate(
    data.endDate,
    "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ."
  );
  if (end <= start) {
    throw new ContractLifecycleError(
      "Ngày kết thúc bảo lưu phải sau ngày bắt đầu."
    );
  }

  const finalReasonType = data.reasonType === "medical" ? "medical" : "other";
  const actualFreezeFee =
    finalReasonType === "medical" ? 0 : Number(data.freezeFee || 0);
  if (!Number.isFinite(actualFreezeFee) || actualFreezeFee < 0) {
    throw new ContractLifecycleError("Phí bảo lưu không hợp lệ.");
  }

  const operationKey = `freeze:${packageId}:${start.toISOString()}:${end.toISOString()}`;
  return runWithOptionalTransaction(models.connection || mongoose.connection, async (session) => {
    const customerPackage = await withSession(
      CustomerPackage.findById(packageId),
      session
    );
    if (!customerPackage) {
      throw new ContractLifecycleError(
        "Không tìm thấy gói tập của hội viên",
        404
      );
    }
    if (customerPackage.status === "transferred") {
      throw new ContractLifecycleError(
        "Hợp đồng này đã được chuyển nhượng và không còn hoạt động trên hệ thống. Không thể thực hiện bảo lưu."
      );
    }

    const lastPeriod = customerPackage.frozenPeriods.at(-1);
    const isRetry =
      customerPackage.status === "frozen" &&
      sameInstant(lastPeriod?.startDate, start) &&
      sameInstant(lastPeriod?.endDate, end);

    if (!isRetry && customerPackage.status !== "active") {
      throw new ContractLifecycleError(
        `Gói tập hiện tại ở trạng thái "${customerPackage.status}", không thể đóng băng.`
      );
    }

    if (!isRetry) {
      const frozenDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
      customerPackage.endDate = new Date(
        customerPackage.endDate.getTime() + frozenDays * DAY_MS
      );
      customerPackage.status = "frozen";
      customerPackage.frozenPeriods.push({
        startDate: start,
        endDate: end,
        reason: data.reason || "Khách hàng yêu cầu tạm ngưng",
        reasonType: finalReasonType,
        freezeFee: actualFreezeFee,
      });
      await customerPackage.save({ session: session || undefined });
    }

    if (actualFreezeFee > 0) {
      const existingTransaction = await withSession(
        Transaction.findOne({ operationKey }),
        session
      );
      if (!existingTransaction) {
        const customer = await withSession(
          Customer.findById(customerPackage.customer),
          session
        );
        await createWithSession(
          Transaction,
          {
            type: "service_fee",
            amount: actualFreezeFee,
            paymentMethod: data.paymentMethod || "Tiền mặt",
            customer: customerPackage.customer,
            customerName: customer?.name || "Hội viên",
            customerPackage: customerPackage._id,
            status: "success",
            staff: actorId,
            operationKey,
          },
          session
        );
      }
    }

    await syncCustomerFields(
      customerPackage.customer,
      { session },
      models
    );
    return { customerPackage, actualFreezeFee, operationKey };
  });
};

const unfreezeContract = async ({ models, packageId, actualUnfreezeDate }) =>
  runWithOptionalTransaction(models.connection || mongoose.connection, async (session) => {
    const customerPackage = await withSession(
      models.CustomerPackage.findById(packageId),
      session
    );
    if (!customerPackage) {
      throw new ContractLifecycleError(
        "Không tìm thấy gói tập của hội viên",
        404
      );
    }

    const lastPeriod = customerPackage.frozenPeriods.at(-1);
    const isProjectionRetry = customerPackage.status === "active" && lastPeriod;
    if (customerPackage.status !== "frozen" && !isProjectionRetry) {
      throw new ContractLifecycleError("Gói tập không ở trạng thái đóng băng.");
    }

    if (!isProjectionRetry) {
      const actualUnfreeze = actualUnfreezeDate
        ? parseDate(
            actualUnfreezeDate,
            "Ngày kích hoạt lại thực tế không hợp lệ."
          )
        : new Date();

      if (lastPeriod && actualUnfreeze < lastPeriod.startDate) {
        throw new ContractLifecycleError(
          "Ngày kích hoạt lại thực tế không thể trước ngày bắt đầu bảo lưu.",
          400,
          "UNFREEZE_BEFORE_FREEZE_START"
        );
      }

      if (lastPeriod && actualUnfreeze < lastPeriod.endDate) {
        const expectedDays = Math.ceil(
          (lastPeriod.endDate.getTime() - lastPeriod.startDate.getTime()) / DAY_MS
        );
        const actualDays = Math.max(
          0,
          Math.ceil(
            (actualUnfreeze.getTime() - lastPeriod.startDate.getTime()) / DAY_MS
          )
        );
        const unusedDays = expectedDays - actualDays;
        if (unusedDays > 0) {
          customerPackage.endDate = new Date(
            customerPackage.endDate.getTime() - unusedDays * DAY_MS
          );
        }
        lastPeriod.endDate = actualUnfreeze;
      }

      customerPackage.status = "active";
      await customerPackage.save({ session: session || undefined });
    }

    await syncCustomerFields(
      customerPackage.customer,
      { session },
      models
    );
    return { customerPackage };
  });

const adjustContractExpiry = async ({
  models,
  packageId,
  newEndDate,
  reason,
  actorId,
}) => {
  if (!newEndDate) {
    throw new ContractLifecycleError("Vui lòng cung cấp ngày hết hạn mới");
  }
  const targetDate = parseDate(newEndDate, "Ngày hết hạn mới không hợp lệ");
  const operationKey = `expiry:${packageId}:${targetDate.toISOString()}`;

  return runWithOptionalTransaction(models.connection || mongoose.connection, async (session) => {
    const pkg = await withSession(
      models.CustomerPackage.findById(packageId),
      session
    );
    if (!pkg) {
      throw new ContractLifecycleError(
        "Không tìm thấy gói tập của hội viên",
        404
      );
    }

    let history = await withSession(
      models.PackageExtensionHistory.findOne({ operationKey }),
      session
    );
    const isReplay = Boolean(history);
    if (!history) {
      const oldEndDate = new Date(pkg.endDate);
      const daysDifference = Math.round(
        (targetDate.getTime() - oldEndDate.getTime()) / DAY_MS
      );
      history = await createWithSession(
        models.PackageExtensionHistory,
        {
          packageId: pkg._id,
          customerId: pkg.customer,
          oldEndDate,
          newEndDate: targetDate,
          daysDifference,
          reason: reason?.trim() || "Admin điều chỉnh ngày hết hạn",
          performedBy: actorId,
          operationKey,
        },
        session
      );
    }

    if (!sameInstant(pkg.endDate, history.newEndDate)) {
      pkg.endDate = history.newEndDate;
      await pkg.save({ session: session || undefined });
    }
    await syncCustomerFields(pkg.customer, { session }, models);

    return { pkg, history, operationKey, isReplay };
  });
};

const loadContractPackageView = ({ CustomerPackage, packageId }) =>
  CustomerPackage.findById(packageId).populate({
    path: "customer",
    populate: {
      path: "referredBy",
      select: "name code phone",
    },
  });

const loadPackageExtensionHistory = ({ PackageExtensionHistory, packageId }) =>
  PackageExtensionHistory.find({ packageId })
    .populate("performedBy", "fullName username role")
    .sort({ createdAt: -1 });

const recordExpiryAdjustmentAudit = async ({
  AuditLog,
  pkg,
  history,
  actorId,
  reason,
  ipAddress,
}) => {
  if (!AuditLog) return { recorded: false, error: new Error("AuditLog model is unavailable") };
  try {
    const direction = history.daysDifference >= 0 ? "+" : "";
    await AuditLog.create({
      user: actorId,
      action: `Điều chỉnh hạn gói tập "${pkg.packageName}": ${direction}${history.daysDifference} ngày`,
      target: pkg._id,
      targetModel: "CustomerPackage",
      details: {
        packageId: pkg._id,
        customerId: pkg.customer,
        oldEndDate: history.oldEndDate,
        newEndDate: history.newEndDate,
        daysDifference: history.daysDifference,
        reason,
      },
      ipAddress,
    });
    return { recorded: true, error: null };
  } catch (error) {
    return { recorded: false, error };
  }
};

module.exports = {
  ContractLifecycleError,
  freezeContract,
  unfreezeContract,
  adjustContractExpiry,
  loadContractPackageView,
  loadPackageExtensionHistory,
  recordExpiryAdjustmentAudit,
};
