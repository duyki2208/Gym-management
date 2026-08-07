const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const ContractTransfer = require("../models/ContractTransfer");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const ExcelJS = require("exceljs");
const { CUSTOMER_STATUS } = require("../utils/constants");
const { sendRegistrationEmail } = require("../utils/emailService");
const syncCustomerFields = require("../utils/syncCustomer");
const faceClient = require("../utils/faceServiceClient");
const { createSaleCommission } = require("./commissionController");
const mongoose = require("mongoose");
const { sendZaloNotification } = require("../utils/zaloService");
const queueService = require("../utils/queueService");



function flattenPackage(pkg) {
  if (!pkg) return null;
  // trainer đã là ObjectId được populate → trả về object { _id, fullName }
  // Nếu chưa populate (lean query), vẫn là ObjectId string → giữ nguyên
  const trainerObj = pkg.trainer
    ? (pkg.trainer.fullName ? { _id: pkg.trainer._id, fullName: pkg.trainer.fullName } : pkg.trainer)
    : null;
  return {
    _id: pkg._id,
    customerId: pkg.customer?._id,
    name: pkg.customer?.name || "",
    code: pkg.customer?.code || "",
    phone: pkg.customer?.phone || "",
    dob: pkg.customer?.dob,
    gender: pkg.customer?.gender || "",
    address: pkg.customer?.address || "",
    avatar: pkg.customer?.avatar || "👤",
    email: pkg.customer?.email || "",
    healthNote: pkg.customer?.healthNote || "",
    faceDescriptor: pkg.customer?.faceDescriptor || [],
    faceEmbedding: pkg.customer?.faceEmbedding || [],
    identityCard: pkg.customer?.identityCard || "",
    emergencyContactName: pkg.customer?.emergencyContactName || "",
    emergencyContactPhone: pkg.customer?.emergencyContactPhone || "",
    source: pkg.customer?.source || "other",
    referredBy: pkg.customer?.referredBy || null,
    
    packageType: pkg.packageName,
    startDate: pkg.startDate,
    endDate: pkg.endDate,
    price: pkg.price,
    remainingSessions: pkg.remainingSessions,
    trainer: trainerObj,
    assignedStaff: pkg.assignedStaff,
    hasLocker: pkg.hasLocker,
    hasWater: pkg.hasWater,
    contractType: pkg.contractType,
    paymentStatus: pkg.paymentStatus,
    paidAmount: pkg.paidAmount,
    contractCode: pkg.contractCode || "",
    packageNote: pkg.packageNote || "",
    status: pkg.status,
    frozenPeriods: pkg.frozenPeriods,
    
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

function isReplicaSetConnected() {
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.client || !conn.client.topology) return false;
    const type = conn.client.topology.description?.type;
    return type === "ReplicaSetWithPrimary" || type === "Sharded" || type === "ReplicaSetNoPrimary";
  } catch (err) {
    return false;
  }
}

const createCustomer = async (req, res) => {
  console.log("--- Executing: createCustomer controller ---");
  let session = null;
  let isTransactionStarted = false;
  let createdCustomerObj = null;
  let isNewCustomerCreated = false;

  try {
    if (isReplicaSetConnected()) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        isTransactionStarted = true;
      } catch (sessErr) {
        isTransactionStarted = false;
      }
    }

    const {
      name,
      phone,
      dob,
      gender,
      address,
      avatar,
      avatarUrl,
      email,
      healthNote,
      packageType,
      startDate,
      endDate,
      price,
      contractCode,
      packageNote,
      remainingSessions,
      trainer,
      assignedStaff,
      hasLocker,
      hasWater,
      contractType,
      paymentStatus,
      paidAmount,
      referredBy,
      source,
      identityCard,
      emergencyContactName,
      emergencyContactPhone,
      faceEmbedding,
    } = req.body;

    if (!name || !phone || !packageType || !endDate) {
      if (isTransactionStarted && session) await session.abortTransaction();
      if (session) session.endSession();
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc (Tên, SĐT, Gói tập, Ngày kết thúc)" });
    }

    let parsedDob = null;
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        parsedDob = d;
      }
    }

    const checkQuery = { name, phone };
    if (parsedDob) {
      checkQuery.dob = parsedDob;
    } else {
      checkQuery.$or = [{ dob: { $exists: false } }, { dob: null }];
    }

    let customer = await Customer.findOne(checkQuery).session(isTransactionStarted ? session : null);
    const isNewCustomer = !customer;
    if (!customer) {
      customer = new Customer({
        name,
        phone,
        dob: parsedDob || undefined,
        gender,
        address,
        avatar,
        avatarUrl: avatarUrl || "",
        email,
        healthNote,
        packageType,
        price: price || 0,
        packageNote: packageNote || "",
        endDate: new Date(endDate),
        identityCard: identityCard || "",
        emergencyContactName: emergencyContactName || "",
        emergencyContactPhone: emergencyContactPhone || "",
        referredBy: referredBy || undefined,
        source: source || "other",
      });
      await customer.save({ session: isTransactionStarted ? session : undefined });
      createdCustomerObj = customer;
      console.log(`Đã tạo hồ sơ khách hàng mới: ${customer.code}`);
    } else {
      createdCustomerObj = customer;
      console.log(`Tìm thấy hồ sơ khách hàng cũ. Sử dụng lại mã: ${customer.code}`);

      if (!contractType || contractType === "new") {
        if (isTransactionStarted && session) await session.abortTransaction();
        if (session) session.endSession();
        return res.status(409).json({
          code: "CONTRACT_TYPE_MISMATCH",
          message: `Khách hàng "${customer.name}" (${customer.code}) đã có hồ sơ trong hệ thống. Vui lòng chọn lại nguồn hợp đồng cho phù hợp.`,
          customerInfo: {
            _id: customer._id,
            name: customer.name,
            code: customer.code,
            phone: customer.phone,
          },
          suggestion: ["renew", "upgrade"],
          isNewCustomer: false,
        });
      }

      if (faceEmbedding && faceEmbedding.length > 0) customer.faceEmbedding = faceEmbedding;
      if (email) customer.email = email;
      if (healthNote) customer.healthNote = healthNote;
      if (avatar) customer.avatar = avatar;
      if (avatarUrl) customer.avatarUrl = avatarUrl;
      if (referredBy) customer.referredBy = referredBy;
      if (source) customer.source = source;
      if (price) customer.price = price;
      await customer.save({ session: isTransactionStarted ? session : undefined });
    }

    if (assignedStaff) {
      const User = require("../models/User");
      const Package = require("../models/Package");
      const staffUser = await User.findById(assignedStaff);
      const pkgInfo = await Package.findOne({ name: packageType });
      if (staffUser && pkgInfo) {
        if (pkgInfo.type === "session" && !["pt", "pm"].includes(staffUser.role)) {
          if (isTransactionStarted && session) await session.abortTransaction();
          if (session) session.endSession();
          return res.status(400).json({ message: "Gói theo buổi bắt buộc chọn nhân viên tư vấn có chức vụ PT hoặc PM!" });
        }
        if (pkgInfo.type === "monthly" && !["sm", "sale"].includes(staffUser.role)) {
          if (isTransactionStarted && session) await session.abortTransaction();
          if (session) session.endSession();
          return res.status(400).json({ message: "Gói theo ngày bắt buộc chọn nhân viên tư vấn có chức vụ SM hoặc Sale!" });
        }
      }
    }

    let finalPaidAmount = paidAmount || 0;
    if (paymentStatus === "paid") {
      finalPaidAmount = price || 0;
    } else if (paymentStatus === "unpaid") {
      finalPaidAmount = 0;
    } else if (paymentStatus === "deposit") {
      if (finalPaidAmount <= 0 || finalPaidAmount >= price) {
        if (isTransactionStarted && session) await session.abortTransaction();
        if (session) session.endSession();
        return res.status(400).json({ message: "Số tiền cọc không hợp lệ" });
      }
    }

    const formattedNote = packageNote || "";

    const customerPackage = new CustomerPackage({
      customer: customer._id,
      packageName: packageType,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      price: price || 0,
      contractCode: contractCode || "HĐ-CŨ",
      packageNote: formattedNote,
      remainingSessions: remainingSessions || 0,
      trainer: trainer || null,
      assignedStaff: assignedStaff || undefined,
      hasLocker: hasLocker || false,
      hasWater: hasWater || false,
      contractType: contractType || "new",
      paymentStatus: paymentStatus || "paid",
      paidAmount: finalPaidAmount,
      status: "active",
    });

    let referralWarning = null;
    if (referredBy && source === "referral") {
      try {
        const referrerPackage = await CustomerPackage.findOne({
          customer: referredBy,
          status: "active"
        }).sort({ endDate: -1 }).session(isTransactionStarted ? session : null);

        const referrerCustomer = await Customer.findById(referredBy).select("name code phone").session(isTransactionStarted ? session : null);

        if (!referrerPackage) {
          // ⚠️ Người giới thiệu không có gói active → cảnh báo admin, KHÔNG cộng tháng
          referralWarning = {
            code: "REFERRER_NO_ACTIVE_PACKAGE",
            message: `Hội viên giới thiệu "${referrerCustomer?.name || referredBy}" (${referrerCustomer?.code || ""}) không có gói tập đang hoạt động. Vui lòng tạo gói mới cho hội viên này để cộng thưởng giới thiệu.`,
            referrerId: referredBy,
            referrerName: referrerCustomer?.name || "",
            referrerCode: referrerCustomer?.code || "",
          };
          console.warn(`[Referral Warning] Người giới thiệu ${referredBy} không có gói active`);
        } else {
          // ✅ Cộng thêm 30 ngày vào gói active của người giới thiệu
          const newEndDate = new Date(referrerPackage.endDate);
          newEndDate.setDate(newEndDate.getDate() + 30);
          referrerPackage.endDate = newEndDate;

          const rewardNote = `+1T giới thiệu HV(${customer.code})`;
          referrerPackage.packageNote = referrerPackage.packageNote
            ? `${referrerPackage.packageNote}\n${rewardNote}`
            : rewardNote;

          await referrerPackage.save({ session: isTransactionStarted ? session : undefined });
          await syncCustomerFields(referredBy, { session: isTransactionStarted ? session : undefined });
          console.log(`Đã tặng thêm 30 ngày cho người giới thiệu: ${referrerCustomer?.name} (${referrerPackage._id})`);
        }

        // Ghi chú vào gói của khách mới: "Được giới thiệu bởi..." -> Không hiển thị thông tin này nữa
      } catch (refErr) {
        console.error("Lỗi cộng thưởng giới thiệu hội viên:", refErr);
      }
    }

    await customerPackage.save({ session: isTransactionStarted ? session : undefined });

    await syncCustomerFields(customer._id, { session: isTransactionStarted ? session : undefined });

    const invoiceDocs = await Invoice.create([
      {
        customer: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        type: "package",
        referenceId: customerPackage._id,
        items: [
          {
            name: customerPackage.packageName,
            quantity: 1,
            price: customerPackage.price,
            total: customerPackage.price,
          },
        ],
        subtotal: customerPackage.price,
        total: customerPackage.price,
        paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
        paymentStatus: customerPackage.paymentStatus,
        staff: req.user ? req.user._id : undefined,
      }
    ], { session: isTransactionStarted ? session : undefined });

    const transactionDocs = await Transaction.create([
      {
        type: "package_purchase",
        amount: customerPackage.paidAmount || 0,
        paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
        customer: customer._id,
        customerName: customer.name,
        customerPackage: customerPackage._id,
        status: "success",
        staff: req.user ? req.user._id : undefined,
      }
    ], { session: isTransactionStarted ? session : undefined });

    // Tự động tạo hoa hồng Sale nếu có nhân viên bán gói
    if (customerPackage.assignedStaff) {
      await createSaleCommission({
        staffId: customerPackage.assignedStaff,
        customerPackageId: customerPackage._id,
        customerId: customer._id,
        packagePrice: customerPackage.price || 0,
        contractType: customerPackage.contractType || "new",
      });
    }

    if (customer.email) {
      let staffName = null;
      if (customerPackage.assignedStaff) {
        const pop = await CustomerPackage.findById(customerPackage._id).populate("assignedStaff", "fullName");
        staffName = pop?.assignedStaff?.fullName || null;
      }
      await sendRegistrationEmail(
        customer.email,
        customer.name,
        customerPackage.packageName,
        customerPackage.startDate,
        customerPackage.endDate,
        customerPackage.price,
        staffName
      );
    }

    // Gửi tin nhắn Zalo OA bất đồng bộ qua Queue ngầm (Non-blocking response)
    if (customer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: customer.phone,
        message: `Chúc mừng ${customer.name} đã đăng ký thành công gói tập ${customerPackage.packageName}. Thời hạn gói: từ ${new Date(customerPackage.startDate).toLocaleDateString("vi-VN")} đến ${new Date(customerPackage.endDate).toLocaleDateString("vi-VN")}. Hân hạnh được phục vụ quý khách!`,
        type: "package_purchase"
      });
    }

    if (isTransactionStarted && session) {
      await session.commitTransaction();
      session.endSession();
      isTransactionStarted = false;
    }

    const populatedPackage = await CustomerPackage.findById(customerPackage._id)
      .populate({
        path: "customer",
        populate: {
          path: "referredBy",
          select: "name code phone"
        }
      })
      .populate("trainer", "fullName username role");
    const responseData = flattenPackage(populatedPackage);
    res.status(201).json({ ...responseData, isNewCustomer, referralWarning });
  } catch (error) {
    if (isTransactionStarted && session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (abortErr) {
        console.error("Lỗi huỷ transaction:", abortErr);
      }
    }
    console.error("Error creating customer:", error);
    res.status(400).json({ message: error.message || "Lỗi tạo khách hàng" });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      paymentStatus,
      contractType,
      packageType,
      assignedStaff,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    } = req.query;

    const query = {};
    const andConditions = [];

    if (search) {
      const customers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { code: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const customerIds = customers.map((c) => c._id);
      andConditions.push({ customer: { $in: customerIds } });
    }

    if (paymentStatus && paymentStatus !== "all") andConditions.push({ paymentStatus });
    if (contractType && contractType !== "all") andConditions.push({ contractType });
    if (packageType && packageType !== "all") andConditions.push({ packageName: packageType });
    if (assignedStaff && assignedStaff !== "all") andConditions.push({ assignedStaff });

    if (startDateFrom || startDateTo) {
      const startCond = {};
      if (startDateFrom) startCond.$gte = new Date(startDateFrom);
      if (startDateTo) startCond.$lte = new Date(startDateTo);
      andConditions.push({ startDate: startCond });
    }

    if (endDateFrom || endDateTo) {
      const endCond = {};
      if (endDateFrom) endCond.$gte = new Date(endDateFrom);
      if (endDateTo) endCond.$lte = new Date(endDateTo);
      andConditions.push({ endDate: endCond });
    }

    const now = new Date();
    if (status === "active" || status === CUSTOMER_STATUS.ACTIVE) {
      andConditions.push({ startDate: { $lte: now } });
      andConditions.push({ endDate: { $gte: now } });
      andConditions.push({ status: "active" });
    } else if (status === "not_activated" || status === CUSTOMER_STATUS.NOT_ACTIVATED) {
      andConditions.push({ startDate: { $gt: now } });
      andConditions.push({ status: "active" });
    } else if (status === "expired" || status === CUSTOMER_STATUS.EXPIRED) {
      andConditions.push({ $or: [{ endDate: { $lt: now } }, { status: "expired" }] });
    } else if (status === "frozen") {
      andConditions.push({ status: "frozen" });
    } else if (status === "expiring" || status === CUSTOMER_STATUS.EXPIRING) {
      const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      andConditions.push({ endDate: { $gte: now, $lte: fourteenDaysLater } });
      andConditions.push({ status: "active" });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const totalPackages = await CustomerPackage.countDocuments(query);

    const packages = await CustomerPackage.find(query)
      .populate({
        path: "customer",
        populate: {
          path: "referredBy",
          select: "name code phone"
        }
      })
      .populate("assignedStaff", "fullName role")
      .populate("trainer", "fullName username role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const flattened = packages.map(flattenPackage).filter(Boolean);

    res.json({
      customers: flattened,
      totalCustomers: totalPackages,
      totalPages: Math.ceil(totalPackages / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách khách hàng:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customerPackage = await CustomerPackage.findById(req.params.id);
    if (!customerPackage) {
      return res.status(404).json({ message: "Không tìm thấy gói tập của hội viên" });
    }

    const customer = await Customer.findById(customerPackage.customer);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ hội viên" });
    }

    const updateData = { ...req.body };

    // Kiểm tra quy luật vai trò nhân viên tư vấn khi cập nhật thông tin
    const checkStaffId = updateData.assignedStaff !== undefined ? updateData.assignedStaff : customerPackage.assignedStaff;
    const checkPackageName = updateData.packageType !== undefined ? updateData.packageType : customerPackage.packageName;
    
    if (checkStaffId) {
      const User = require("../models/User");
      const Package = require("../models/Package");
      const staffUser = await User.findById(checkStaffId);
      const pkgInfo = await Package.findOne({ name: checkPackageName });
      if (staffUser && pkgInfo) {
        if (pkgInfo.type === "session" && !["pt", "pm"].includes(staffUser.role)) {
          return res.status(400).json({ message: "Gói theo buổi bắt buộc chọn nhân viên tư vấn có chức vụ PT hoặc PM!" });
        }
        if (pkgInfo.type === "monthly" && !["sm", "sale"].includes(staffUser.role)) {
          return res.status(400).json({ message: "Gói theo ngày bắt buộc chọn nhân viên tư vấn có chức vụ SM hoặc Sale!" });
        }
      }
    }

    const customerFields = [
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
    const packageFields = [
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

    customerFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "dob") {
          if (!updateData[field] || updateData[field] === "Invalid Date") {
            customer[field] = null;
          } else {
            const parsedDate = new Date(updateData[field]);
            if (isNaN(parsedDate.getTime())) {
              customer[field] = null;
            } else {
              customer[field] = parsedDate;
            }
          }
        } else if (field === "referredBy" && updateData[field] === "") {
          customer[field] = null;
        } else {
          customer[field] = updateData[field];
        }
      }
    });
    await customer.save();

    const currentStatus = updateData.paymentStatus !== undefined ? updateData.paymentStatus : customerPackage.paymentStatus;
    const currentPrice = updateData.price !== undefined ? updateData.price : customerPackage.price;
    let currentPaidAmount = updateData.paidAmount !== undefined ? updateData.paidAmount : customerPackage.paidAmount;

    if (currentStatus === "paid") {
      currentPaidAmount = currentPrice;
    } else if (currentStatus === "unpaid") {
      currentPaidAmount = 0;
    } else if (currentStatus === "deposit") {
      if (currentPaidAmount <= 0 || currentPaidAmount >= currentPrice) {
        return res.status(400).json({ message: "Số tiền cọc không hợp lệ" });
      }
    }
    updateData.paidAmount = currentPaidAmount;

    packageFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "packageType") {
          customerPackage.packageName = updateData[field];
        } else if ((field === "startDate" || field === "endDate") && typeof updateData[field] === "string") {
          customerPackage[field] = new Date(updateData[field]);
        } else if ((field === "trainer" || field === "assignedStaff") && updateData[field] === "") {
          customerPackage[field] = null;
        } else {
          customerPackage[field] = updateData[field];
        }
      }
    });
    await customerPackage.save();

    // Đồng bộ giao dịch (Transaction) liên quan
    let transaction = await Transaction.findOne({ customerPackage: customerPackage._id });
    if (transaction) {
      transaction.amount = customerPackage.paidAmount || 0;
      transaction.paymentMethod = customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR";
      transaction.customerName = customer.name;
      await transaction.save();
    } else {
      await Transaction.create({
        type: "package_purchase",
        amount: customerPackage.paidAmount || 0,
        paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
        customer: customer._id,
        customerName: customer.name,
        customerPackage: customerPackage._id,
        status: "success",
        staff: req.user ? req.user._id : undefined,
        createdAt: customerPackage.createdAt || new Date(), // Giữ nguyên ngày tạo gốc của gói tập để không làm sai lệch doanh thu tháng này
      });
    }

    // Đồng bộ hoa hồng (Commission) liên quan khi sửa thông tin
    const Commission = require("../models/Commission");
    
    // 1. Nếu thay đổi nhân viên tư vấn -> cập nhật người hưởng hoa hồng hoặc thu hồi nếu xóa
    if (updateData.assignedStaff !== undefined) {
      if (customerPackage.assignedStaff) {
        await Commission.updateMany(
          { customerPackage: customerPackage._id },
          { staff: customerPackage.assignedStaff }
        );
      } else {
        await Commission.updateMany(
          { customerPackage: customerPackage._id, status: "active" },
          {
            status: "revoked",
            revokedReason: "Thay đổi nhân viên tư vấn thành trống",
            revokedAt: new Date(),
            revokedBy: req.user ? req.user._id : undefined,
          }
        );
      }
    }

    // 2. Nếu thay đổi giá gói tập hoặc loại hợp đồng -> tính lại hoa hồng của các bản ghi active liên quan
    if (updateData.price !== undefined || updateData.contractType !== undefined) {
      const commissions = await Commission.find({ customerPackage: customerPackage._id, status: "active" });
      for (const comm of commissions) {
        comm.baseAmount = customerPackage.price || 0;
        comm.amount = comm.baseAmount * (comm.rate / 100);
        if (updateData.contractType !== undefined) {
          comm.contractType = customerPackage.contractType;
        }
        await comm.save();
      }
    }

    // Đồng bộ hóa đơn (Invoice) liên quan
    let invoice = await Invoice.findOne({ referenceId: customerPackage._id });
    if (invoice) {
      invoice.customerName = customer.name;
      invoice.customerPhone = customer.phone;
      invoice.paymentStatus = customerPackage.paymentStatus;
      invoice.paymentMethod = customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR";
      invoice.subtotal = customerPackage.price || 0;
      invoice.total = customerPackage.price || 0;
      if (invoice.items && invoice.items.length > 0) {
        invoice.items[0].name = customerPackage.packageName;
        invoice.items[0].price = customerPackage.price || 0;
        invoice.items[0].total = customerPackage.price || 0;
      }
      await invoice.save();
    } else {
      await Invoice.create({
        customer: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        type: "package",
        referenceId: customerPackage._id,
        items: [
          {
            name: customerPackage.packageName,
            quantity: 1,
            price: customerPackage.price || 0,
            total: customerPackage.price || 0,
          },
        ],
        subtotal: customerPackage.price || 0,
        total: customerPackage.price || 0,
        paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
        paymentStatus: customerPackage.paymentStatus,
        staff: req.user ? req.user._id : undefined,
      });
    }

    await syncCustomerFields(customer._id);

    const updatedPopulated = await CustomerPackage.findById(customerPackage._id)
      .populate({
        path: "customer",
        populate: {
          path: "referredBy",
          select: "name code phone"
        }
      })
      .populate("assignedStaff", "fullName role")
      .populate("trainer", "fullName username role");

    res.json(flattenPackage(updatedPopulated));
  } catch (error) {
    console.error("Lỗi cập nhật khách hàng:", error);
    res.status(400).json({ message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const customerPackage = await CustomerPackage.findById(req.params.id);
    if (!customerPackage) {
      return res.status(404).json({ message: "Không tìm thấy gói tập cần xóa" });
    }

    const customerId = customerPackage.customer;

    // Kiểm tra kỳ hoa hồng Sale đã bị khóa (approved hoặc paid) chưa
    const CommissionPeriod = require("../models/CommissionPeriod");
    const pkgMonth = new Date(customerPackage.createdAt).getMonth() + 1;
    const pkgYear = new Date(customerPackage.createdAt).getFullYear();
    const lockedPeriod = await CommissionPeriod.findOne({
      month: pkgMonth,
      year: pkgYear,
      type: "sale",
      status: { $in: ["approved", "paid"] }
    });
    if (lockedPeriod) {
      return res.status(400).json({ message: "Kỳ thanh toán hoa hồng Sale của gói tập này đã được duyệt hoặc chi trả, không thể xóa." });
    }

    // Thu hồi hoa hồng liên quan nếu có
    const Commission = require("../models/Commission");
    await Commission.updateMany(
      { customerPackage: customerPackage._id, status: "active" },
      {
        status: "revoked",
        revokedReason: "Xóa hợp đồng / gói tập",
        revokedAt: new Date(),
        revokedBy: req.user ? req.user._id : undefined,
      }
    );

    // Lấy thông tin khách hàng gốc trước khi đánh dấu xóa mềm
    const customer = await Customer.findById(customerId);

    // Thu hồi ngày thưởng giới thiệu cho người giới thiệu nếu hợp lệ
    // Điều kiện: Gói bị xóa là gói "new", khách hàng này có referredBy và nguồn là "referral"
    if (customer && customer.referredBy && customer.source === "referral" && customerPackage.contractType === "new") {
      try {
        const rewardNote = `+1T giới thiệu HV(${customer.code})`;
        // Tìm gói tập của người giới thiệu có ghi chú tặng thưởng của hội viên bị xóa này
        const referrerPackage = await CustomerPackage.findOne({
          customer: customer.referredBy,
          packageNote: { $regex: new RegExp(rewardNote.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }
        });

        if (referrerPackage) {
          // Trừ đi 30 ngày thưởng
          const newEndDate = new Date(referrerPackage.endDate);
          newEndDate.setDate(newEndDate.getDate() - 30);
          referrerPackage.endDate = newEndDate;

          // Xóa dòng ghi chú thưởng tương ứng
          if (referrerPackage.packageNote) {
            referrerPackage.packageNote = referrerPackage.packageNote
              .split("\n")
              .filter(line => !line.toLowerCase().includes(rewardNote.toLowerCase()))
              .join("\n")
              .trim();
          }

          await referrerPackage.save();
          await syncCustomerFields(customer.referredBy);
          console.log(`Đã thu hồi 30 ngày thưởng giới thiệu từ người giới thiệu: ${customer.referredBy} (${referrerPackage._id})`);
        }
      } catch (refErr) {
        console.error("Lỗi khi thu hồi ngày thưởng giới thiệu:", refErr);
      }
    }

    // Sao lưu dữ liệu bị xóa vào req để ghi vào Audit Log
    req.deletedCustomerDetails = {
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
      }
    };

    if (customer) {
      req.deletedCustomerDetails.customer = {
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
      };
    }

    // Kiểm tra xem gói này có đang được tham chiếu bởi gói nâng cấp nào không
    const isReferencedByUpgrade = await CustomerPackage.findOne({
      upgradedFrom: customerPackage._id
    }, null, { withDeleted: true }); // Tìm kể cả trong bản ghi đã soft-delete

    // Soft Delete gói tập để bảo toàn lịch sử và audit trail
    customerPackage.isDeleted = true;
    await customerPackage.save();

    // Hủy bỏ giao dịch liên quan để không tính vào doanh thu
    await Transaction.updateMany(
      { customerPackage: customerPackage._id },
      { status: "failed" }
    );

    // Kiểm tra xem khách hàng này còn gói tập nào khác hoạt động không
    const remainingPackagesCount = await CustomerPackage.countDocuments({
      customer: customerId,
      isDeleted: { $ne: true }
    });

    if (remainingPackagesCount === 0) {
      if (customer) {
        customer.isDeleted = true;
        await customer.save();
      }
    } else {
      await syncCustomerFields(customerId);
    }

    res.json({ message: "Đã xóa gói tập thành công" });
  } catch (error) {
    console.error("Lỗi xóa khách hàng:", error);
    res.status(500).json({ message: error.message });
  }
};

const freezeCustomer = async (req, res) => {
  try {
    const customerPackage = await CustomerPackage.findById(req.params.id);
    if (!customerPackage) {
      return res.status(404).json({ message: "Không tìm thấy gói tập của hội viên" });
    }

    // Guard: Gói đã chuyển nhượng — khóa vĩnh viễn, không cho thực hiện bất kỳ thao tác nào
    if (customerPackage.status === "transferred") {
      return res.status(400).json({ message: "Hợp đồng này đã được chuyển nhượng và không còn hoạt động trên hệ thống. Không thể thực hiện bảo lưu." });
    }

    if (customerPackage.status !== "active") {
      return res.status(400).json({ message: `Gói tập hiện tại ở trạng thái "${customerPackage.status}", không thể đóng băng.` });
    }

    const { startDate, endDate, reason, reasonType, freezeFee, paymentMethod } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ ngày bắt đầu và ngày kết thúc bảo lưu." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ." });
    }

    if (end <= start) {
      return res.status(400).json({ message: "Ngày kết thúc bảo lưu phải sau ngày bắt đầu." });
    }

    const diffMs = end.getTime() - start.getTime();
    const expectedFrozenDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (expectedFrozenDays > 0) {
      customerPackage.endDate = new Date(customerPackage.endDate.getTime() + expectedFrozenDays * 24 * 60 * 60 * 1000);
    }

    const finalReasonType = reasonType === "medical" ? "medical" : "other";
    const actualFreezeFee = finalReasonType === "medical" ? 0 : Number(freezeFee || 0);

    customerPackage.status = "frozen";
    customerPackage.frozenPeriods.push({
      startDate: start,
      endDate: end,
      reason: reason || "Khách hàng yêu cầu tạm ngưng",
      reasonType: finalReasonType,
      freezeFee: actualFreezeFee,
    });

    await customerPackage.save();

    if (actualFreezeFee > 0) {
      const customerObj = await Customer.findById(customerPackage.customer);
      await Transaction.create({
        type: "service_fee",
        amount: actualFreezeFee,
        paymentMethod: paymentMethod || "Tiền mặt",
        customer: customerPackage.customer,
        customerName: customerObj?.name || "Hội viên",
        customerPackage: customerPackage._id,
        status: "success",
        staff: req.user ? req.user._id : undefined,
      });
    }

    await syncCustomerFields(customerPackage.customer);

    res.status(200).json({
      success: true,
      message: actualFreezeFee > 0
        ? `Tạm dừng gói tập thành công (Đã thu phí bảo lưu ${actualFreezeFee.toLocaleString('vi-VN')} VNĐ).`
        : "Tạm dừng gói tập thành công (Miễn phí bảo lưu lý do y tế/thương tích).",
      data: flattenPackage(await CustomerPackage.findById(customerPackage._id).populate({
        path: "customer",
        populate: {
          path: "referredBy",
          select: "name code phone"
        }
      })),
    });
  } catch (error) {
    console.error("Lỗi đóng băng gói tập:", error);
    res.status(500).json({ message: error.message });
  }
};

const upgradeCustomerPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPackageId, assignedStaff, paymentMethod } = req.body;

    const oldPackage = await CustomerPackage.findById(id);
    if (!oldPackage) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng gốc cần nâng cấp." });
    }

    // Guard: Gói đã chuyển nhượng — không thể nâng cấp
    if (oldPackage.status === "transferred") {
      return res.status(400).json({ success: false, message: "Hợp đồng này đã được chuyển nhượng và không còn hoạt động trên hệ thống. Không thể thực hiện nâng cấp." });
    }

    if (oldPackage.status !== "active") {
      return res.status(400).json({ success: false, message: `Hợp đồng hiện ở trạng thái "${oldPackage.status}", không thể nâng cấp.` });
    }

    const PackageModel = require("../models/Package");
    const newPkgInfo = await PackageModel.findById(newPackageId);
    if (!newPkgInfo) {
      return res.status(404).json({ success: false, message: "Không tìm thấy gói tập mới cần nâng cấp." });
    }

    const oldPkgInfo = await PackageModel.findOne({ name: oldPackage.packageName });
    if (oldPkgInfo && oldPkgInfo.type !== "monthly") {
      return res.status(400).json({ success: false, message: "Tính năng nâng cấp hợp đồng chỉ áp dụng cho gói Member (tính theo ngày), không áp dụng gói PT." });
    }

    const now = new Date();
    const startDate = new Date(oldPackage.startDate);
    const diffDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 30) {
      return res.status(400).json({
        success: false,
        message: `Hợp đồng đã đăng ký được ${diffDays} ngày. Chỉ được phép nâng cấp trong vòng 30 ngày kể từ ngày tạo hợp đồng gốc.`,
      });
    }

    const priceDiff = newPkgInfo.price - oldPackage.price;
    if (priceDiff <= 0) {
      return res.status(400).json({
        success: false,
        message: `Giá gói mới (${newPkgInfo.price.toLocaleString("vi-VN")}đ) phải lớn hơn giá gói cũ (${oldPackage.price.toLocaleString("vi-VN")}đ).`,
      });
    }

    // Tính lại ngày hết hạn theo thời lượng gói tập mới từ ngày bắt đầu ban đầu (Cơ chế 1)
    const durationDays = newPkgInfo.duration || 30;
    const newEndDate = new Date(new Date(oldPackage.startDate).getTime() + durationDays * 24 * 60 * 60 * 1000);

    const newContractCode = oldPackage.contractCode ? `${oldPackage.contractCode}-UP` : `HĐ-UPGRADE`;
    const newCustomerPackage = new CustomerPackage({
      customer: oldPackage.customer,
      package: newPkgInfo._id,
      packageName: newPkgInfo.name,
      startDate: oldPackage.startDate,
      endDate: newEndDate,
      price: newPkgInfo.price,
      contractCode: newContractCode,
      packageNote: `Nâng cấp từ gói [${oldPackage.packageName}] (Thu thêm ${priceDiff.toLocaleString("vi-VN")}đ)`,
      status: "active",
      assignedStaff: assignedStaff || oldPackage.assignedStaff,
      contractType: "upgrade",
      paymentStatus: "paid",
      paidAmount: newPkgInfo.price,
      upgradedFrom: oldPackage._id,
      upgradeDeltaPrice: priceDiff,
      hasLocker: oldPackage.hasLocker,
      hasWater: oldPackage.hasWater,
    });
    await newCustomerPackage.save();

    // Soft-delete gói A cũ và đổi status thành upgraded để bảo toàn liên kết tham chiếu
    oldPackage.isDeleted = true;
    oldPackage.status = "upgraded";
    await oldPackage.save();

    const customerObj = await Customer.findById(oldPackage.customer);
    await Transaction.create({
      type: "package_purchase",
      amount: priceDiff,
      paymentMethod: paymentMethod || "Tiền mặt",
      customer: oldPackage.customer,
      customerName: customerObj?.name || "Hội viên",
      customerPackage: newCustomerPackage._id,
      status: "success",
      staff: req.user ? req.user._id : undefined,
    });

    const { handleUpgradeCommission } = require("./commissionController");
    await handleUpgradeCommission({
      oldPackage,
      newPackageId: newPkgInfo._id,
      newPackagePrice: newPkgInfo.price,
      newCustomerPackageId: newCustomerPackage._id,
      customerId: oldPackage.customer,
      upgradeSaleStaffId: assignedStaff || oldPackage.assignedStaff,
      priceDiff,
    });

    await syncCustomerFields(oldPackage.customer);

    res.status(200).json({
      success: true,
      message: `Nâng cấp hợp đồng lên gói [${newPkgInfo.name}] thành công! Thu thêm ${priceDiff.toLocaleString("vi-VN")} VNĐ.`,
      data: newCustomerPackage,
    });
  } catch (error) {
    console.error("Lỗi nâng cấp hợp đồng:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const transferCustomerPackage = async (req, res) => {
  try {
    // Phân quyền: Chỉ cho phép Admin hoặc Manager
    const allowedRoles = ["admin", "manager"];
    if (req.user && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Tài khoản quyền "${req.user.role}" không có quyền thực hiện chuyển nhượng hợp đồng. Yêu cầu quyền Admin/Quản lý.`
      });
    }

    const { id } = req.params;
    const { targetCustomerId, newCustomer, dobForExisting, note, paymentMethod } = req.body;

    // 1. Tìm hợp đồng gốc
    const originalPkg = await CustomerPackage.findById(id);
    if (!originalPkg) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng cần chuyển nhượng." });
    }

    // Validation: Hợp đồng phải ở trạng thái active
    if (originalPkg.status !== "active") {
      return res.status(400).json({ success: false, message: `Hợp đồng hiện ở trạng thái "${originalPkg.status}", không thể chuyển nhượng.` });
    }

    // Validation: Hợp đồng phải được thanh toán 100% (paid)
    if (originalPkg.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Hợp đồng chưa hoàn tất thanh toán (100%), không thể thực hiện chuyển nhượng." });
    }

    // 2. Xác định người nhận (B) và validate
    let targetCustomer = null;

    if (targetCustomerId) {
      // Mode: Chọn khách có sẵn
      if (targetCustomerId.toString() === originalPkg.customer.toString()) {
        return res.status(400).json({ success: false, message: "Không thể chuyển nhượng hợp đồng cho chính chủ sở hữu." });
      }

      targetCustomer = await Customer.findById(targetCustomerId);
      if (!targetCustomer) {
        return res.status(404).json({ success: false, message: "Không tìm thấy thông tin hội viên nhận chuyển nhượng." });
      }
      // Bắt buộc có ngày sinh
      if (!targetCustomer.dob && !dobForExisting) {
        return res.status(400).json({ success: false, message: "Hội viên này chưa có ngày sinh trong hệ thống. Vui lòng nhập ngày sinh để tiếp tục chuyển nhượng." });
      }
      if (dobForExisting) {
        targetCustomer.dob = new Date(dobForExisting);
        await targetCustomer.save();
      }
    } else if (newCustomer) {
      // Mode: Tạo khách mới
      const { name, phone, dob, gender, email, address, identityCard, emergencyContactName, emergencyContactPhone } = newCustomer;
      if (!name || !phone) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Họ tên và Số điện thoại của người nhận hợp đồng." });
      }
      if (!dob) {
        return res.status(400).json({ success: false, message: "Ngày sinh (DOB) của người nhận hợp đồng là bắt buộc." });
      }

      const parsedDob = new Date(dob);
      if (isNaN(parsedDob.getTime())) {
        return res.status(400).json({ success: false, message: "Ngày sinh không hợp lệ." });
      }

      // Check duplicate name + phone + dob
      const existingCust = await Customer.findOne({
        name: name.trim(),
        phone: phone.trim(),
        dob: parsedDob,
        isDeleted: { $ne: true }
      });

      if (existingCust) {
        return res.status(400).json({ success: false, message: "Khách hàng này đã tồn tại trong hệ thống. Vui lòng dùng chức năng 'Khách cũ' để chọn." });
      }

      // Kiểm tra trùng riêng SĐT để tránh tạo rác SĐT
      const existingPhone = await Customer.findOne({ phone: phone.trim(), isDeleted: { $ne: true } });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: `Số điện thoại ${phone} đã thuộc về hội viên "${existingPhone.name}". Vui lòng dùng chức năng 'Khách cũ'.` });
      }

      targetCustomer = new Customer({
        name: name.trim(),
        phone: phone.trim(),
        dob: parsedDob,
        gender: gender || "Khác",
        email: email || "",
        address: address || "",
        identityCard: identityCard || "",
        emergencyContactName: emergencyContactName || "",
        emergencyContactPhone: emergencyContactPhone || "",
        packageType: originalPkg.packageName,
        endDate: originalPkg.endDate,
        contractCode: originalPkg.contractCode || "",
        remainingSessions: originalPkg.remainingSessions || 0,
        source: "transfer",
        contractType: "transfer",
      });
      await targetCustomer.save();
    } else {
      return res.status(400).json({ success: false, message: "Vui lòng chọn hội viên có sẵn hoặc nhập thông tin người nhận hợp đồng mới." });
    }

    // 3. Lấy phí chuyển nhượng từ Setting
    const Setting = require("../models/Setting");
    const setting = await Setting.findOne();
    const transferFee = setting?.transferFee ?? 1000000;

    const transferDate = new Date();
    const previousOwnerId = originalPkg.customer;
    const fromCustomer = await Customer.findById(previousOwnerId);
    const dateStr = transferDate.toLocaleDateString("vi-VN");

    // Phương án B: Clone hợp đồng mới cho người nhận & Đánh dấu gói gốc đã chuyển nhượng
    const originalCustomerFirst = originalPkg.originalCustomer || previousOwnerId;
    const newContractCode = originalPkg.contractCode
      ? (originalPkg.contractCode.includes("-TR") ? originalPkg.contractCode : `${originalPkg.contractCode}-TR`)
      : `HĐ-TRANSFER`;

    const transferNoteForNew = `[Nhận chuyển nhượng ${dateStr}] Từ ${fromCustomer ? fromCustomer.name : "Khách cũ"}${note ? ` | Ghi chú: ${note}` : ""}`;

    // 4. Tạo gói mới cho Khách B (status: "active", transferredFrom: originalPkg._id)
    const newCustomerPackage = new CustomerPackage({
      customer: targetCustomer._id,
      package: originalPkg.package,
      packageName: originalPkg.packageName,
      startDate: originalPkg.startDate,
      endDate: originalPkg.endDate,
      price: originalPkg.price,
      contractCode: newContractCode,
      packageNote: transferNoteForNew,
      remainingSessions: originalPkg.remainingSessions || 0,
      status: "active",
      trainer: originalPkg.trainer || null,
      assignedStaff: originalPkg.assignedStaff,
      hasLocker: false,
      hasWater: originalPkg.hasWater || false,
      contractType: "transfer",
      paymentStatus: "paid",
      paidAmount: originalPkg.paidAmount || originalPkg.price,
      originalCustomer: originalCustomerFirst,
      transferredFrom: originalPkg._id,
      transferFee: transferFee,
    });
    await newCustomerPackage.save();

    // 5. Cập nhật gói gốc của Khách A (status: "transferred", transferredTo: newCustomerPackage._id)
    const transferNoteForOld = `[Đã chuyển nhượng ${dateStr}] Sang ${targetCustomer.name}${note ? ` | Ghi chú: ${note}` : ""}`;
    originalPkg.originalCustomer = originalCustomerFirst;
    originalPkg.status = "transferred";
    originalPkg.transferredTo = newCustomerPackage._id;
    originalPkg.contractType = "transfer";
    originalPkg.transferFee = (originalPkg.transferFee || 0) + transferFee;
    originalPkg.hasLocker = false; // Gỡ tủ đồ của chủ cũ
    originalPkg.packageNote = originalPkg.packageNote
      ? `${originalPkg.packageNote}\n${transferNoteForOld}`
      : transferNoteForOld;
    await originalPkg.save();

    // 6. Lưu vết vào Bảng ContractTransfer
    const transferRecord = await ContractTransfer.create({
      contract: originalPkg._id,
      fromCustomer: previousOwnerId,
      toCustomer: targetCustomer._id,
      transferDate: transferDate,
      transferFee: transferFee,
      staff: req.user ? req.user._id : undefined,
      note: note || "",
      remainingSessionsAtTransfer: originalPkg.remainingSessions || 0,
      endDateAtTransfer: originalPkg.endDate,
    });

    // 7. Ghi Transaction phí chuyển nhượng (Service Fee - không hoa hồng)
    await Transaction.create({
      type: "service_fee",
      amount: transferFee,
      paymentMethod: paymentMethod || "Tiền mặt",
      customer: targetCustomer._id,
      customerName: targetCustomer.name,
      customerPackage: newCustomerPackage._id,
      status: "success",
      staff: req.user ? req.user._id : undefined,
      note: `Phí chuyển nhượng hợp đồng ${originalPkg.contractCode} (từ ${fromCustomer ? fromCustomer.name : 'A'} sang ${targetCustomer.name})`,
    });

    // 8. Re-sync đồng bộ số liệu cả người chuyển và người nhận
    await syncCustomerFields(targetCustomer._id);
    await syncCustomerFields(previousOwnerId);

    // 9. Ghi AuditLog
    const AuditLog = require("../models/AuditLog");
    await AuditLog.create({
      user: req.user ? req.user._id : undefined,
      username: req.user ? (req.user.fullName || req.user.username) : "Hệ thống",
      action: `Chuyển nhượng HĐ ${originalPkg.contractCode} sang ${targetCustomer.name}`,
      method: req.method || "POST",
      path: req.originalUrl || req.path || `/api/v1/customers/packages/${originalPkg._id}/transfer`,
      details: {
        contractCode: originalPkg.contractCode,
        fromCustomer: fromCustomer ? fromCustomer.name : previousOwnerId,
        toCustomer: targetCustomer.name,
        transferFee,
        newPackageId: newCustomerPackage._id,
      },
    });

    res.status(200).json({
      success: true,
      message: `Chuyển nhượng hợp đồng [${originalPkg.contractCode}] sang hội viên [${targetCustomer.name}] thành công! Phí dịch vụ: ${transferFee.toLocaleString("vi-VN")} VNĐ.`,
      data: {
        contract: newCustomerPackage,
        oldContract: originalPkg,
        transferRecord,
      },
    });
  } catch (error) {
    console.error("Lỗi chuyển nhượng hợp đồng:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const unfreezeCustomer = async (req, res) => {
  try {
    const customerPackage = await CustomerPackage.findById(req.params.id);
    if (!customerPackage) {
      return res.status(404).json({ message: "Không tìm thấy gói tập của hội viên" });
    }

    if (customerPackage.status !== "frozen") {
      return res.status(400).json({ message: "Gói tập không ở trạng thái đóng băng." });
    }

    const { actualUnfreezeDate } = req.body;
    const actualUnfreeze = actualUnfreezeDate ? new Date(actualUnfreezeDate) : new Date();

    if (isNaN(actualUnfreeze.getTime())) {
      return res.status(400).json({ message: "Ngày kích hoạt lại thực tế không hợp lệ." });
    }

    const activePeriod = customerPackage.frozenPeriods[customerPackage.frozenPeriods.length - 1];
    if (activePeriod) {
      if (actualUnfreeze < activePeriod.endDate) {
        const expectedDiff = activePeriod.endDate.getTime() - activePeriod.startDate.getTime();
        const expectedDays = Math.ceil(expectedDiff / (1000 * 60 * 60 * 24));

        const actualDiff = actualUnfreeze.getTime() - activePeriod.startDate.getTime();
        const actualDays = Math.max(0, Math.ceil(actualDiff / (1000 * 60 * 60 * 24)));

        const diffDays = expectedDays - actualDays;
        if (diffDays > 0) {
          customerPackage.endDate = new Date(customerPackage.endDate.getTime() - diffDays * 24 * 60 * 60 * 1000);
        }

        activePeriod.endDate = actualUnfreeze;
      }
    }

    customerPackage.status = "active";
    await customerPackage.save();

    await syncCustomerFields(customerPackage.customer);

    res.status(200).json({
      success: true,
      message: `Kích hoạt lại gói tập thành công. Hạn gói tập đã được điều chỉnh theo thời gian bảo lưu thực tế.`,
      data: flattenPackage(await CustomerPackage.findById(customerPackage._id).populate({
        path: "customer",
        populate: {
          path: "referredBy",
          select: "name code phone"
        }
      })),
    });
  } catch (error) {
    console.error("Lỗi kích hoạt lại gói tập:", error);
    res.status(500).json({ message: error.message });
  }
};


/**
 * @desc   Đăng ký/Cập nhật khuôn mặt cho khách hàng qua InsightFace
 * @route  POST /api/v1/customers/:id/enroll-face
 * @access Private
 */
const enrollFace = async (req, res) => {
  try {
    let customer = await Customer.findById(req.params.id);
    if (!customer) {
      const customerPackage = await CustomerPackage.findById(req.params.id);
      if (customerPackage) {
        customer = await Customer.findById(customerPackage.customer);
      }
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng gửi ảnh kèm theo" });
    }

    // Gọi Python service để lấy embedding
    const result = await faceClient.getEmbedding(req.file.buffer);

    if (!result.found) {
      return res.status(422).json({
        success: false,
        message: result.message || "Không phát hiện khuôn mặt trong ảnh. Hãy chụp lại.",
      });
    }

    // Lưu embedding vào DB
    customer.faceEmbedding = result.embedding;
    
    // Upload ảnh lên Cloudinary
    try {
      const { uploadBuffer, extractPublicId, cloudinary: cloudinaryClient } = require("../config/cloudinary");
      
      // Xóa ảnh cũ trên Cloudinary nếu có
      if (customer.avatarUrl) {
        const oldPublicId = extractPublicId(customer.avatarUrl);
        if (oldPublicId) {
          await cloudinaryClient.uploader.destroy(oldPublicId).catch(err => {
            console.error("Lỗi xóa ảnh cũ trên Cloudinary:", err.message);
          });
        }
      }
      
      const uploadResult = await uploadBuffer(req.file.buffer);
      customer.avatarUrl = uploadResult.secure_url;
      customer.avatar = ""; // Reset base64 cũ để giải phóng dung lượng
    } catch (uploadErr) {
      console.error("Lỗi upload avatar lên Cloudinary:", uploadErr);
      // Vẫn tiếp tục dùng base64 dự phòng nếu upload thất bại
      if (req.body.imageBase64) {
        customer.avatar = req.body.imageBase64;
      }
    }
    await customer.save();

    res.json({
      success: true,
      message: "Cập nhật khuôn mặt thành công!",
      data: { 
        embeddingSize: result.embedding.length,
        avatarUrl: customer.avatarUrl
      },
    });
  } catch (error) {
    // Xử lý lỗi khi Python service down
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        success: false,
        message: "Dịch vụ nhận diện khuôn mặt chưa khởi động. Vui lòng chạy face-service trước.",
      });
    }
    console.error("enrollFace error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * GET /api/v1/customers/check-existing?name=...&phone=...&dob=...
 * Kiểm tra khách hàng có tồn tại không (KHÔNG ghi dữ liệu).
 * Dùng để validate real-time trên form trước khi submit.
 */
const checkExistingCustomer = async (req, res) => {
  try {
    const { name, phone, dob } = req.query;

    if (!name || !phone) {
      return res.json({ exists: false });
    }

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    const checkQuery = {
      name: { $regex: new RegExp(`^${normalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      phone: normalizedPhone,
    };

    let parsedDob = null;
    if (dob && dob !== "Invalid Date") {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) parsedDob = d;
    }

    if (parsedDob) {
      checkQuery.dob = parsedDob;
    } else {
      checkQuery.$or = [
        { dob: { $exists: false } },
        { dob: null },
      ];
    }

    const customer = await Customer.findOne(checkQuery).select('_id name code phone dob');

    if (!customer) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      customer: {
        _id: customer._id,
        name: customer.name,
        code: customer.code,
        phone: customer.phone,
      },
    });
  } catch (error) {
    console.error("checkExistingCustomer error:", error);
    res.status(500).json({ exists: false });
  }
};

const exportCustomersExcel = async (req, res) => {
  try {
    const {
      expiringDays,
      paymentStatus,
      hasNoPT,
      trainerId,
      assignedStaffId,
      packageName,
      startDateFrom,
      startDateTo,
      preset,
      search,
    } = req.query;

    const andConditions = [];
    const now = new Date();

    if (search) {
      const customers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { code: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const customerIds = customers.map((c) => c._id);
      andConditions.push({ customer: { $in: customerIds } });
    }

    if (preset === "today_call") {
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      andConditions.push({
        $or: [
          { endDate: { $gte: now, $lte: sevenDaysLater }, status: "active" },
          { paymentStatus: "deposit" },
        ],
      });
    } else {
      if (expiringDays) {
        const days = parseInt(expiringDays);
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        andConditions.push({ endDate: { $gte: now, $lte: futureDate }, status: "active" });
      }
      if (paymentStatus && paymentStatus !== "all") {
        andConditions.push({ paymentStatus });
      }
      if (hasNoPT === "true" || hasNoPT === true) {
        andConditions.push({ $or: [{ trainer: null }, { trainer: { $exists: false } }] });
      }
      if (trainerId && trainerId !== "all") {
        andConditions.push({ trainer: trainerId });
      }
      if (assignedStaffId && assignedStaffId !== "all") {
        andConditions.push({ assignedStaff: assignedStaffId });
      }
      if (packageName && packageName !== "all") {
        andConditions.push({ packageName });
      }
      if (startDateFrom || startDateTo) {
        const startCond = {};
        if (startDateFrom) startCond.$gte = new Date(startDateFrom);
        if (startDateTo) startCond.$lte = new Date(startDateTo);
        andConditions.push({ startDate: startCond });
      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const packages = await CustomerPackage.find(query)
      .populate("customer")
      .populate("assignedStaff", "fullName role")
      .populate("trainer", "fullName username role")
      .sort({ endDate: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GymPro Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Danh Sách Khách Hàng");

    worksheet.mergeCells("A1:K1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "DANH SÁCH KHÁCH HÀNG / HỘI VIÊN GYMPRO";
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells("A2:K2");
    const subCell = worksheet.getCell("A2");
    subCell.value = `Thời gian xuất: ${new Date().toLocaleString("vi-VN")} | Tổng số bản ghi: ${packages.length}`;
    subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "475569" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const headers = [
      "STT",
      "Mã KH",
      "Họ và Tên",
      "Số Điện Thoại",
      "Gói Tập",
      "Ngày Hết Hạn",
      "Còn (Ngày)",
      "PT Phụ Trách",
      "Sale Phụ Trách",
      "Trạng Thái TT",
      "Ghi Chú Gói",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "CBD5E1" } },
        bottom: { style: "medium", color: { argb: "1E40AF" } },
        left: { style: "thin", color: { argb: "CBD5E1" } },
        right: { style: "thin", color: { argb: "CBD5E1" } },
      };
    });

    packages.forEach((pkg, index) => {
      const customer = pkg.customer || {};
      const endDate = pkg.endDate ? new Date(pkg.endDate) : null;
      let remainingDays = 0;
      if (endDate) {
        const diffMs = endDate.getTime() - now.getTime();
        remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      let paymentText = "Đã TT";
      if (pkg.paymentStatus === "deposit") paymentText = "Đặt cọc (Nợ)";
      else if (pkg.paymentStatus === "unpaid") paymentText = "Chưa TT";

      const rowData = [
        index + 1,
        customer.code || "N/A",
        customer.name || "N/A",
        customer.phone || "N/A",
        pkg.packageName || "N/A",
        endDate ? endDate.toLocaleDateString("vi-VN") : "N/A",
        remainingDays,
        pkg.trainer?.fullName || "Chưa gán",
        pkg.assignedStaff?.fullName || "Chưa gán",
        paymentText,
        pkg.packageNote || "",
      ];

      const row = worksheet.addRow(rowData);
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Calibri", size: 11 };
        cell.border = {
          top: { style: "thin", color: { argb: "E2E8F0" } },
          bottom: { style: "thin", color: { argb: "E2E8F0" } },
          left: { style: "thin", color: { argb: "E2E8F0" } },
          right: { style: "thin", color: { argb: "E2E8F0" } },
        };
        if ([1, 2, 4, 6, 7, 10].includes(colNumber)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });

      if (remainingDays >= 0 && remainingDays <= 7 && pkg.status === "active") {
        row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        row.getCell(7).font = { color: { argb: "991B1B" }, bold: true };
      } else if (remainingDays < 0) {
        row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F4F6" } };
        row.getCell(7).font = { color: { argb: "6B7280" } };
      }

      if (pkg.paymentStatus === "deposit") {
        row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
        row.getCell(10).font = { color: { argb: "92400E" }, bold: true };
      }
    });

    worksheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(maxLen + 4, 35);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="GymPro_Customers_${Date.now()}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Lỗi xuất Excel khách hàng:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi xuất Excel khách hàng" });
  }
};

module.exports = {
  getAll: getAllCustomers,
  create: createCustomer,
  delete: deleteCustomer,
  update: updateCustomer,
  freeze: freezeCustomer,
  unfreeze: unfreezeCustomer,
  enrollFace,
  checkExisting: checkExistingCustomer,
  exportExcel: exportCustomersExcel,
  upgradePackage: upgradeCustomerPackage,
  transferPackage: transferCustomerPackage,
};
