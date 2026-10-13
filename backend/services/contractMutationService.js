const mongoose = require("mongoose");
const { runWithOptionalTransaction } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");

const DAY_MS = 24 * 60 * 60 * 1000;

class ContractMutationError extends Error {
  constructor(message, statusCode = 400, code = "CONTRACT_MUTATION_FAILED") {
    super(message);
    this.name = "ContractMutationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const withSession = (query, session) => session ? query.session(session) : query;
const createOne = (Model, data, session) =>
  session
    ? Model.create([data], { session }).then(([document]) => document)
    : Model.create(data);

const findPackageIncludingDeleted = (CustomerPackage, id, session) =>
  withSession(CustomerPackage.findOne({ _id: id }, null, { withDeleted: true }), session);

const findByOperationKey = (CustomerPackage, operationKey, session) =>
  withSession(CustomerPackage.findOne({ operationKey }), session);

const ensureTransaction = async ({
  models,
  operationKey,
  type,
  amount,
  paymentMethod,
  customer,
  customerName,
  customerPackage,
  actorId,
  note,
  session,
}) => {
  let transaction = await withSession(
    models.Transaction.findOne({ operationKey }),
    session
  );
  if (!transaction) {
    transaction = await createOne(
      models.Transaction,
      {
        type,
        amount,
        paymentMethod,
        customer,
        customerName,
        customerPackage,
        status: "success",
        staff: actorId,
        note,
        operationKey,
      },
      session
    );
  }
  return transaction;
};

const runRetrySafe = async ({ models, operationKey, work }) => {
  try {
    return await runWithOptionalTransaction(
      models.connection || mongoose.connection,
      work
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;

    // A concurrent request may win the unique operationKey race. Read its
    // result and run the repair path once more instead of surfacing a 500.
    const existing = await models.CustomerPackage.findOne({ operationKey });
    if (!existing) throw error;
    return runWithOptionalTransaction(
      models.connection || mongoose.connection,
      work
    );
  }
};

const upgradeContract = async ({ models, packageId, data, actorId }) => {
  const operationKey = `contract-upgrade:${packageId}`;
  let commissionInput = null;

  const result = await runRetrySafe({
    models,
    operationKey,
    work: async (session) => {
      let newCustomerPackage = await findByOperationKey(
        models.CustomerPackage,
        operationKey,
        session
      );
      const isReplay = Boolean(newCustomerPackage);
      const oldPackage = await findPackageIncludingDeleted(
        models.CustomerPackage,
        packageId,
        session
      );
      if (!oldPackage) {
        throw new ContractMutationError(
          "Không tìm thấy hợp đồng gốc cần nâng cấp.",
          404,
          "SOURCE_CONTRACT_NOT_FOUND"
        );
      }

      let newPkgInfo;
      let priceDiff;
      if (!newCustomerPackage) {
        if (oldPackage.status === "transferred") {
          throw new ContractMutationError(
            "Hợp đồng này đã được chuyển nhượng và không thể nâng cấp."
          );
        }
        if (oldPackage.status !== "active") {
          throw new ContractMutationError(
            `Hợp đồng hiện ở trạng thái "${oldPackage.status}", không thể nâng cấp.`
          );
        }

        newPkgInfo = await withSession(models.Package.findById(data.newPackageId), session);
        if (!newPkgInfo) {
          throw new ContractMutationError(
            "Không tìm thấy gói tập mới cần nâng cấp.",
            404,
            "TARGET_PACKAGE_NOT_FOUND"
          );
        }
        const oldPkgInfo = await withSession(
          models.Package.findOne({ name: oldPackage.packageName }),
          session
        );
        if (oldPkgInfo && oldPkgInfo.type !== "monthly") {
          throw new ContractMutationError(
            "Tính năng nâng cấp chỉ áp dụng cho gói Member (tính theo ngày)."
          );
        }

        const diffDays = Math.ceil(
          (Date.now() - new Date(oldPackage.startDate).getTime()) / DAY_MS
        );
        if (diffDays > 30) {
          throw new ContractMutationError(
            `Hợp đồng đã đăng ký được ${diffDays} ngày. Chỉ được nâng cấp trong vòng 30 ngày.`
          );
        }
        priceDiff = Number(newPkgInfo.price) - Number(oldPackage.price);
        if (priceDiff <= 0) {
          throw new ContractMutationError("Giá gói mới phải lớn hơn giá gói cũ.");
        }

        const durationDays = newPkgInfo.duration || 30;
        const endDate = new Date(
          new Date(oldPackage.startDate).getTime() + durationDays * DAY_MS
        );
        newCustomerPackage = await createOne(
          models.CustomerPackage,
          {
            customer: oldPackage.customer,
            package: newPkgInfo._id,
            packageName: newPkgInfo.name,
            startDate: oldPackage.startDate,
            endDate,
            price: newPkgInfo.price,
            contractCode: oldPackage.contractCode
              ? `${oldPackage.contractCode}-UP`
              : "HĐ-UPGRADE",
            packageNote: `Nâng cấp từ gói [${oldPackage.packageName}] (Thu thêm ${priceDiff.toLocaleString("vi-VN")}đ)`,
            status: "active",
            assignedStaff: data.assignedStaff || oldPackage.assignedStaff,
            contractType: "upgrade",
            paymentStatus: "paid",
            paidAmount: newPkgInfo.price,
            upgradedFrom: oldPackage._id,
            upgradeDeltaPrice: priceDiff,
            hasLocker: oldPackage.hasLocker,
            hasWater: oldPackage.hasWater,
            operationKey,
          },
          session
        );
      } else {
        priceDiff = Number(newCustomerPackage.upgradeDeltaPrice || 0);
        newPkgInfo = await withSession(
          models.Package.findById(newCustomerPackage.package),
          session
        );
      }

      if (oldPackage.status !== "upgraded" || oldPackage.isDeleted !== true) {
        oldPackage.status = "upgraded";
        oldPackage.isDeleted = true;
        await oldPackage.save({ session: session || undefined });
      }

      const customer = await withSession(
        models.Customer.findById(oldPackage.customer),
        session
      );
      const transaction = await ensureTransaction({
        models,
        operationKey,
        type: "package_purchase",
        amount: priceDiff,
        paymentMethod: data.paymentMethod || "Tiền mặt",
        customer: oldPackage.customer,
        customerName: customer?.name || "Hội viên",
        customerPackage: newCustomerPackage._id,
        actorId,
        session,
      });
      await syncCustomerFields(oldPackage.customer, { session }, models);

      commissionInput = {
        oldPackage,
        newPackageId: newCustomerPackage.package,
        newPackagePrice: newCustomerPackage.price,
        newCustomerPackageId: newCustomerPackage._id,
        customerId: oldPackage.customer,
        upgradeSaleStaffId:
          data.assignedStaff || newCustomerPackage.assignedStaff,
        priceDiff,
      };
      return {
        oldPackage,
        newCustomerPackage,
        transaction,
        targetPackageName: newPkgInfo?.name || newCustomerPackage.packageName,
        priceDiff,
        operationKey,
        isReplay,
      };
    },
  });

  if (commissionInput && models.handleUpgradeCommission) {
    const existingCommission = models.Commission
      ? await models.Commission.findOne({
          customerPackage: result.newCustomerPackage._id,
          type: "sale",
        })
      : null;
    if (!existingCommission) await models.handleUpgradeCommission(commissionInput);
  }
  return result;
};

const resolveTransferTarget = async ({ models, originalPkg, data, session }) => {
  const dobForExisting = data.dobForExisting || data.targetCustomerDob;
  const newCustomer = data.newCustomer || data.newCustomerData;
  if (data.targetCustomerId) {
    if (String(data.targetCustomerId) === String(originalPkg.customer)) {
      throw new ContractMutationError("Không thể chuyển nhượng hợp đồng cho chính chủ sở hữu.");
    }
    const target = await withSession(models.Customer.findById(data.targetCustomerId), session);
    if (!target) {
      throw new ContractMutationError(
        "Không tìm thấy hội viên nhận chuyển nhượng.",
        404,
        "TARGET_CUSTOMER_NOT_FOUND"
      );
    }
    if (!target.dob && !dobForExisting) {
      throw new ContractMutationError("Ngày sinh của hội viên nhận chuyển nhượng là bắt buộc.");
    }
    if (dobForExisting && !target.dob) {
      const dob = new Date(dobForExisting);
      if (Number.isNaN(dob.getTime())) {
        throw new ContractMutationError("Ngày sinh không hợp lệ.");
      }
      target.dob = dob;
      await target.save({ session: session || undefined });
    }
    return target;
  }

  if (!newCustomer) {
    throw new ContractMutationError(
      "Vui lòng chọn hội viên có sẵn hoặc nhập thông tin người nhận mới."
    );
  }
  const input = newCustomer;
  if (!input.name || !input.phone || !input.dob) {
    throw new ContractMutationError("Họ tên, số điện thoại và ngày sinh người nhận là bắt buộc.");
  }
  const dob = new Date(input.dob);
  if (Number.isNaN(dob.getTime())) {
    throw new ContractMutationError("Ngày sinh không hợp lệ.");
  }
  const phone = input.phone.trim();
  const duplicate = await withSession(
    models.Customer.findOne({ phone, isDeleted: { $ne: true } }),
    session
  );
  if (duplicate) {
    throw new ContractMutationError(
      `Số điện thoại ${phone} đã thuộc về hội viên "${duplicate.name}".`
    );
  }
  return createOne(
    models.Customer,
    {
      name: input.name.trim(),
      phone,
      dob,
      gender: input.gender || "Khác",
      email: input.email || "",
      address: input.address || "",
      identityCard: input.identityCard || "",
      emergencyContactName: input.emergencyContactName || "",
      emergencyContactPhone: input.emergencyContactPhone || "",
      packageType: originalPkg.packageName,
      endDate: originalPkg.endDate,
      contractCode: originalPkg.contractCode || "",
      remainingSessions: originalPkg.remainingSessions || 0,
      source: "transfer",
      contractType: "transfer",
    },
    session
  );
};

const transferContract = async ({ models, packageId, data, actorId, audit }) => {
  const operationKey = `contract-transfer:${packageId}`;
  return runRetrySafe({
    models,
    operationKey,
    work: async (session) => {
      let newCustomerPackage = await findByOperationKey(
        models.CustomerPackage,
        operationKey,
        session
      );
      const isReplay = Boolean(newCustomerPackage);
      const originalPkg = await findPackageIncludingDeleted(
        models.CustomerPackage,
        packageId,
        session
      );
      if (!originalPkg) {
        throw new ContractMutationError(
          "Không tìm thấy hợp đồng cần chuyển nhượng.",
          404,
          "SOURCE_CONTRACT_NOT_FOUND"
        );
      }
      if (!isReplay && originalPkg.status !== "active") {
        throw new ContractMutationError(
          `Hợp đồng hiện ở trạng thái "${originalPkg.status}", không thể chuyển nhượng.`
        );
      }
      if (!isReplay && originalPkg.paymentStatus !== "paid") {
        throw new ContractMutationError("Hợp đồng phải được thanh toán 100% trước khi chuyển nhượng.");
      }

      let targetCustomer;
      if (newCustomerPackage) {
        targetCustomer = await withSession(
          models.Customer.findById(newCustomerPackage.customer),
          session
        );
      } else {
        targetCustomer = await resolveTransferTarget({
          models,
          originalPkg,
          data,
          session,
        });
      }
      const previousOwnerId = originalPkg.customer;
      const fromCustomer = await withSession(
        models.Customer.findById(previousOwnerId),
        session
      );
      const setting = await withSession(models.Setting.findOne(), session);
      const transferFee = setting?.transferFee ?? 1000000;

      if (!newCustomerPackage) {
        const transferDate = new Date();
        const originalCustomer = originalPkg.originalCustomer || previousOwnerId;
        const note = `[Nhận chuyển nhượng ${transferDate.toLocaleDateString("vi-VN")}] Từ ${fromCustomer?.name || "Khách cũ"}${data.note ? ` | Ghi chú: ${data.note}` : ""}`;
        newCustomerPackage = await createOne(
          models.CustomerPackage,
          {
            customer: targetCustomer._id,
            package: originalPkg.package,
            packageName: originalPkg.packageName,
            startDate: originalPkg.startDate,
            endDate: originalPkg.endDate,
            price: originalPkg.price,
            contractCode: originalPkg.contractCode?.includes("-TR")
              ? originalPkg.contractCode
              : `${originalPkg.contractCode || "HĐ-TRANSFER"}-TR`,
            packageNote: note,
            remainingSessions: originalPkg.remainingSessions || 0,
            status: "active",
            trainer: originalPkg.trainer || null,
            assignedStaff: originalPkg.assignedStaff,
            hasLocker: false,
            hasWater: originalPkg.hasWater || false,
            contractType: "transfer",
            paymentStatus: "paid",
            paidAmount: originalPkg.paidAmount || originalPkg.price,
            originalCustomer,
            transferredFrom: originalPkg._id,
            transferFee,
            operationKey,
          },
          session
        );
      }

      if (originalPkg.status !== "transferred" || !originalPkg.transferredTo) {
        originalPkg.originalCustomer = originalPkg.originalCustomer || previousOwnerId;
        originalPkg.status = "transferred";
        originalPkg.transferredTo = newCustomerPackage._id;
        originalPkg.contractType = "transfer";
        originalPkg.transferFee = transferFee;
        originalPkg.hasLocker = false;
        await originalPkg.save({ session: session || undefined });
      }

      let transferRecord = await withSession(
        models.ContractTransfer.findOne({ contract: originalPkg._id }),
        session
      );
      if (!transferRecord) {
        transferRecord = await createOne(
          models.ContractTransfer,
          {
            contract: originalPkg._id,
            fromCustomer: previousOwnerId,
            toCustomer: targetCustomer._id,
            transferDate: new Date(),
            transferFee,
            staff: actorId,
            note: data.note || "",
            remainingSessionsAtTransfer: originalPkg.remainingSessions || 0,
            endDateAtTransfer: originalPkg.endDate,
          },
          session
        );
      }
      const transaction = await ensureTransaction({
        models,
        operationKey,
        type: "service_fee",
        amount: transferFee,
        paymentMethod: data.paymentMethod || "Tiền mặt",
        customer: targetCustomer._id,
        customerName: targetCustomer.name,
        customerPackage: newCustomerPackage._id,
        actorId,
        note: `Phí chuyển nhượng hợp đồng ${originalPkg.contractCode}`,
        session,
      });
      await syncCustomerFields(targetCustomer._id, { session }, models);
      await syncCustomerFields(previousOwnerId, { session }, models);

      if (models.AuditLog) {
        const existingAudit = await withSession(
          models.AuditLog.findOne({
            action: `TRANSFER_CONTRACT:${operationKey}`,
          }),
          session
        );
        if (!existingAudit) {
          await createOne(
            models.AuditLog,
            {
              user: actorId,
              username: audit?.username || "Hệ thống",
              action: `TRANSFER_CONTRACT:${operationKey}`,
              method: audit?.method || "POST",
              path: audit?.path,
              details: {
                contractCode: originalPkg.contractCode,
                fromCustomer: fromCustomer?.name || previousOwnerId,
                toCustomer: targetCustomer.name,
                transferFee,
                newPackageId: newCustomerPackage._id,
              },
            },
            session
          );
        }
      }
      return {
        originalPkg,
        newCustomerPackage,
        transferRecord,
        transaction,
        targetCustomer,
        transferFee,
        operationKey,
        isReplay,
      };
    },
  });
};

module.exports = {
  ContractMutationError,
  upgradeContract,
  transferContract,
};
