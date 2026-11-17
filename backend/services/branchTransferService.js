const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { isReplicaSetConnected } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");

const fail = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const sameId = (a, b) => String(a || "") === String(b || "");
const clientOf = (connection) => connection?.getClient?.() || connection?.client;
const createOne = async (Model, value, session) => (await Model.create([value], { session }))[0];

const normalizeTransfer = (data = {}, requestKey) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw fail("INVALID_BRANCH_TRANSFER", "Thông tin chuyển cơ sở không hợp lệ", 400);
  const { customerId, packageId, targetBranchCode, transferFee = 0, paymentMethod = "Tiền mặt", note = "" } = data;
  if (!mongoose.isObjectIdOrHexString(customerId) ||
      (packageId !== undefined && !mongoose.isObjectIdOrHexString(packageId)) ||
      typeof targetBranchCode !== "string" || !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(targetBranchCode.trim().toUpperCase()) ||
      !Number.isSafeInteger(transferFee) || transferFee < 0 ||
      typeof paymentMethod !== "string" || !paymentMethod.trim() || paymentMethod.length > 80 ||
      typeof note !== "string" || note.length > 2000 ||
      (requestKey !== undefined && (typeof requestKey !== "string" || !/^[A-Za-z0-9._:-]{1,200}$/.test(requestKey)))) {
    throw fail("INVALID_BRANCH_TRANSFER", "Thông tin chuyển cơ sở không hợp lệ", 400);
  }
  if (!packageId && !requestKey) {
    throw fail("TRANSFER_IDENTITY_REQUIRED", "Cần packageId hoặc Idempotency-Key để gửi lại yêu cầu an toàn", 400);
  }
  return { customerId: String(customerId).toLowerCase(), packageId: packageId ? String(packageId).toLowerCase() : undefined,
    targetBranchCode: targetBranchCode.trim().toUpperCase(), transferFee, paymentMethod: paymentMethod.trim(), note: note.trim(), requestKey };
};

const fingerprint = (input, packageId) => crypto.createHash("sha256").update(JSON.stringify([
  input.customerId, String(packageId), input.targetBranchCode, input.transferFee, input.paymentMethod, input.note,
])).digest("hex");

const receiptResult = (pkg, input, sourceBranchCode) => {
  const receipt = pkg.branchTransfer;
  if (!receipt?.fingerprint || receipt.fingerprint !== fingerprint(input, pkg._id)) {
    throw fail("TRANSFER_REQUEST_CONFLICT", "Gói hoặc mã thao tác đã được dùng cho yêu cầu chuyển khác");
  }
  return { sourceBranchCode, sourcePackageId: pkg._id, targetBranchCode: pkg.branchTransferredTo,
    invoiceCode: receipt.invoiceCode || null, targetCustomerId: receipt.targetCustomerId,
    targetPackageId: receipt.targetPackageId, transferFee: receipt.transferFee, idempotent: true, atomic: true };
};

const loadSource = async (models, input, session = null) => {
  const query = (value) => session ? value.session(session) : value;
  let packageId = input.packageId;
  if (input.requestKey) {
    const previous = await query(models.CustomerPackage.findOne({ "branchTransfer.requestKey": input.requestKey }));
    if (previous) {
      if ((packageId && !sameId(packageId, previous._id)) || !sameId(previous.customer, input.customerId)) {
        throw fail("TRANSFER_REQUEST_CONFLICT", "Idempotency-Key đã được dùng cho gói hoặc hội viên khác");
      }
      packageId = previous._id;
    }
  }
  const customer = await query(models.Customer.findById(input.customerId));
  if (!customer) throw fail("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng tại chi nhánh nguồn", 404);
  const pkg = await query(models.CustomerPackage.findOne({ _id: packageId || customer.activePackage, customer: customer._id }));
  if (!pkg) throw fail("CUSTOMER_PACKAGE_NOT_FOUND", "Không tìm thấy gói tập thuộc hội viên nguồn", 404);
  return { customer, pkg };
};

const assertTransferable = (pkg) => {
  if (pkg.transferStatus === "transfer_pending") {
    throw fail("LEGACY_TRANSFER_PENDING", "Giao dịch chuyển cũ đang dở dang, cần đối soát trước khi tiếp tục");
  }
  if (pkg.transferStatus === "transferred_out" || pkg.status !== "active") {
    throw fail("PACKAGE_NOT_TRANSFERABLE", "Gói tập không còn ở trạng thái cho phép chuyển cơ sở");
  }
};

const transferBranch = async ({ sourceModels, centralModels, getTargetModels, sourceBranchCode, data, actorId, requestKey }) => {
  const input = normalizeTransfer(data, requestKey);
  const sourceCode = String(sourceBranchCode || "").trim().toUpperCase();
  if (!sourceCode || sourceCode === input.targetBranchCode) throw fail("INVALID_TARGET_BRANCH", "Chi nhánh đích không được trùng chi nhánh nguồn", 400);
  const first = await loadSource(sourceModels, input);
  if (first.pkg.transferStatus === "transferred_out" && first.pkg.branchTransfer?.fingerprint) return receiptResult(first.pkg, input, sourceCode);
  assertTransferable(first.pkg);
  const targetBranch = await centralModels.Branch.findOne({ code: input.targetBranchCode, isActive: true });
  if (!targetBranch) throw fail("TARGET_BRANCH_NOT_FOUND", "Chi nhánh đích không tồn tại hoặc đã ngừng hoạt động", 404);
  const sourceClient = clientOf(sourceModels.connection);
  if (!isReplicaSetConnected(sourceModels.connection)) throw fail("MONGO_TRANSACTIONS_REQUIRED", "Chuyển cơ sở cần MongoDB replica set", 503);
  const targetModels = await getTargetModels(input.targetBranchCode);
  if (!sourceClient || clientOf(targetModels.connection) !== sourceClient || clientOf(centralModels.connection) !== sourceClient ||
      sourceModels.connection.name === targetModels.connection.name || targetModels.connection.name !== targetBranch.dbName) {
    throw fail("TRANSFER_TOPOLOGY_UNSUPPORTED", "Các database chi nhánh phải riêng biệt và dùng chung MongoClient", 503);
  }
  // Initialize collections/indexes before starting a cross-database transaction.
  await Promise.all([sourceModels.Customer, sourceModels.CustomerPackage, sourceModels.Invoice, sourceModels.Transaction, sourceModels.Counter,
    targetModels.Customer, targetModels.CustomerPackage, targetModels.Counter].map(Model => Model.init()));
  if (input.requestKey) {
    // init() may skip indexes when autoIndex is disabled; the key must remain unique across packages.
    const indexes = await sourceModels.CustomerPackage.collection.indexes();
    if (!indexes.some(index => index.unique && Object.keys(index.key).length === 1 && index.key["branchTransfer.requestKey"] === 1 &&
        index.partialFilterExpression?.["branchTransfer.requestKey"]?.$type === "string")) {
      throw fail("TRANSFER_INDEX_REQUIRED", "Chưa có unique index cho mã chuyển cơ sở; cần hoàn tất index trước khi xử lý", 503);
    }
  }

  const session = await sourceModels.connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { customer, pkg } = await loadSource(sourceModels, input, session);
      if (pkg.transferStatus === "transferred_out" && pkg.branchTransfer?.fingerprint) {
        result = receiptResult(pkg, input, sourceCode); return;
      }
      assertTransferable(pkg);
      const activeTarget = await centralModels.Branch.findOne({ code: input.targetBranchCode, isActive: true }).session(session);
      if (!activeTarget) throw fail("TARGET_BRANCH_NOT_FOUND", "Chi nhánh đích đã ngừng hoạt động", 404);
      if (activeTarget.dbName !== targetModels.connection.name) throw fail("TRANSFER_TOPOLOGY_UNSUPPORTED", "Ánh xạ database chi nhánh đích đã thay đổi", 503);
      const claimed = await sourceModels.CustomerPackage.updateOne({ _id: pkg._id, customer: customer._id,
        status: "active", transferStatus: { $in: ["none", null] } }, { $set: { transferStatus: "transfer_pending" } }, { session });
      if (claimed.modifiedCount !== 1) throw fail("TRANSFER_IN_PROGRESS", "Gói tập đã thay đổi hoặc đang được chuyển");

      const operationKey = `branch-transfer:${sourceCode}:${pkg._id}`;
      const matches = await targetModels.Customer.find({ phone: customer.phone }).limit(2).session(session);
      if (matches.length > 1) throw fail("AMBIGUOUS_TARGET_CUSTOMER", "Nhiều hội viên đích trùng số điện thoại, cần đối soát");
      let targetCustomer = matches[0];
      const now = new Date();
      if (!targetCustomer) {
        targetCustomer = await createOne(targetModels.Customer, {
          name: customer.name, phone: customer.phone, dob: customer.dob, gender: customer.gender, address: customer.address,
          avatar: customer.avatar, avatarUrl: customer.avatarUrl, email: customer.email, healthNote: customer.healthNote,
          identityCard: customer.identityCard, emergencyContactName: customer.emergencyContactName,
          emergencyContactPhone: customer.emergencyContactPhone, faceEmbedding: customer.faceEmbedding || [],
          packageType: pkg.packageName, startDate: now, endDate: pkg.endDate, source: "branch_transfer",
        }, session);
      } else if (!targetCustomer.faceEmbedding?.length && customer.faceEmbedding?.length) {
        targetCustomer.faceEmbedding = customer.faceEmbedding;
        await targetCustomer.save({ session });
      }
      const targetPackage = await createOne(targetModels.CustomerPackage, {
        customer: targetCustomer._id, packageName: pkg.packageName, category: pkg.category,
        startDate: now, endDate: pkg.endDate, price: pkg.price, contractCode: `TR-${pkg.contractCode}`,
        packageNote: `Chuyển nhượng từ chi nhánh ${sourceCode}. ${input.note}`.trim(),
        remainingSessions: pkg.remainingSessions, status: "active", transferStatus: "none", branchTransferredFrom: sourceCode,
        hasLocker: pkg.hasLocker, hasWater: pkg.hasWater, contractType: "transfer", paymentStatus: pkg.paymentStatus,
        paidAmount: pkg.paidAmount, transferFee: input.transferFee, operationKey,
      }, session);
      let invoice = null;
      if (input.transferFee > 0) {
        invoice = await createOne(sourceModels.Invoice, {
          customer: customer._id, customerName: customer.name, customerPhone: customer.phone,
          type: "transfer", referenceId: pkg._id,
          items: [{ name: `Phí chuyển cơ sở từ ${sourceCode} sang ${input.targetBranchCode}`, quantity: 1, price: input.transferFee, total: input.transferFee }],
          subtotal: input.transferFee, discount: 0, total: input.transferFee, paymentMethod: input.paymentMethod, paymentStatus: "paid", staff: actorId,
        }, session);
        await createOne(sourceModels.Transaction, { type: "service_fee", amount: input.transferFee, paymentMethod: input.paymentMethod,
          customer: customer._id, customerName: customer.name, customerPackage: pkg._id, status: "success", staff: actorId, operationKey }, session);
      }
      pkg.transferStatus = "transferred_out"; pkg.status = "transferred";
      pkg.branchTransferredTo = input.targetBranchCode; pkg.branchTransferDate = now; pkg.transferredTo = targetPackage._id;
      pkg.branchTransfer = { fingerprint: fingerprint(input, pkg._id), requestKey: input.requestKey,
        targetCustomerId: targetCustomer._id, targetPackageId: targetPackage._id, invoiceCode: invoice?.code,
        transferFee: input.transferFee, completedAt: now, actorId };
      await pkg.save({ session });
      await syncCustomerFields(targetCustomer._id, { session }, targetModels);
      await syncCustomerFields(customer._id, { session }, sourceModels);
      result = { ...receiptResult(pkg, input, sourceCode), idempotent: false };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw fail("TRANSFER_REQUEST_CONFLICT", "Mã thao tác hoặc gói đích đã tồn tại; đối chiếu kết quả trước khi gửi lại");
    }
    throw error;
  } finally { await session.endSession(); }
};

module.exports = { transferBranch };
