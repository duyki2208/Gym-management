const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const { CUSTOMER_STATUS } = require("../utils/constants");
const { sendRegistrationEmail } = require("../utils/emailService");
const syncCustomerFields = require("../utils/syncCustomer");
const faceClient = require("../utils/faceServiceClient");
const { createSaleCommission } = require("./commissionController");
const mongoose = require("mongoose");
const { sendZaloNotification } = require("../utils/zaloService");



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

const createCustomer = async (req, res) => {
  console.log("--- Executing: createCustomer controller ---");
  try {
    const requiredFields = ["name", "phone", "packageType", "endDate"];
    const missing = requiredFields.filter((f) => !req.body[f]);
    if (missing.length > 0) {
      return res.status(400).json({ message: `Thiếu trường: ${missing.join(", ")}` });
    }

    const {
      name,
      phone,
      dob,
      gender,
      address,
      avatar,
      email,
      healthNote,
      faceEmbedding,

      packageType,
      startDate,
      endDate,
      price,
      remainingSessions,
      trainer,
      assignedStaff,
      hasLocker,
      hasWater,
      contractType,
      paymentStatus,
      paidAmount,
      contractCode,
      packageNote,
      identityCard,
      emergencyContactName,
      emergencyContactPhone,
      referredBy,
      source,
      avatarUrl,
    } = req.body;

    const normalizedName = name ? name.trim() : "";
    const normalizedPhone = phone ? phone.trim() : "";
    
    const checkQuery = { 
      name: { $regex: new RegExp(`^${normalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }, 
      phone: normalizedPhone 
    };

    let parsedDob = null;
    if (dob && dob !== "Invalid Date") {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        parsedDob = d;
      }
    }

    if (parsedDob) {
      checkQuery.dob = parsedDob;
    } else {
      checkQuery.$or = [
        { dob: { $exists: false } },
        { dob: null }
      ];
    }
    
    let customer = await Customer.findOne(checkQuery);
    const isNewCustomer = !customer; // Đánh dấu trước khi tạo mới

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

        packageNote: packageNote || "",
        endDate: new Date(endDate),
        identityCard: identityCard || "",
        emergencyContactName: emergencyContactName || "",
        emergencyContactPhone: emergencyContactPhone || "",
        referredBy: referredBy || undefined,
        source: source || "other",
      });
      await customer.save();
      console.log(`Đã tạo hồ sơ khách hàng mới: ${customer.code}`);
    } else {
      console.log(`Tìm thấy hồ sơ khách hàng cũ. Sử dụng lại mã: ${customer.code}`);

      // ⚠️ Chặn sớm: khách cũ không được dùng contractType "new"
      if (!contractType || contractType === "new") {
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
      await customer.save();
    }

    // Kiểm tra kỳ hoa hồng Sale đã bị khóa (approved hoặc paid) chưa
    const CommissionPeriod = require("../models/CommissionPeriod");
    const now = new Date();
    const lockedPeriod = await CommissionPeriod.findOne({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      type: "sale",
      status: { $in: ["approved", "paid"] }
    });
    if (lockedPeriod) {
      return res.status(400).json({ message: "Kỳ thanh toán hoa hồng Sale tháng này đã được duyệt hoặc chi trả, dữ liệu đã bị khóa." });
    }

    // Kiểm tra quy luật vai trò nhân viên tư vấn
    if (assignedStaff) {
      const User = require("../models/User");
      const Package = require("../models/Package");
      const staffUser = await User.findById(assignedStaff);
      const pkgInfo = await Package.findOne({ name: packageType });
      if (staffUser && pkgInfo) {
        if (pkgInfo.type === "session" && !["pt", "pm"].includes(staffUser.role)) {
          return res.status(400).json({ message: "Gói theo buổi bắt buộc chọn nhân viên tư vấn có chức vụ PT hoặc PM!" });
        }
        if (pkgInfo.type === "monthly" && !["sm", "sale"].includes(staffUser.role)) {
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
      trainer: trainer || null, // ObjectId ref User hoặc null
      assignedStaff: assignedStaff || undefined,
      hasLocker: hasLocker || false,
      hasWater: hasWater || false,
      contractType: contractType || "new",
      paymentStatus: paymentStatus || "paid",
      paidAmount: finalPaidAmount,
      status: "active",
    });

    // Logic referral: tặng thêm 1 tháng cho người giới thiệu
    // Điều kiện: phải có referredBy VÀ source phải là "referral"
    let referralWarning = null;
    if (referredBy && source === "referral") {
      try {
        const referrerPackage = await CustomerPackage.findOne({
          customer: referredBy,
          status: "active"
        }).sort({ endDate: -1 });

        const referrerCustomer = await Customer.findById(referredBy).select("name code phone");

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

          await referrerPackage.save();
          await syncCustomerFields(referredBy);
          console.log(`Đã tặng thêm 30 ngày cho người giới thiệu: ${referrerCustomer?.name} (${referrerPackage._id})`);
        }

        // Ghi chú vào gói của khách mới: "Được giới thiệu bởi..." -> Không hiển thị thông tin này nữa
      } catch (refErr) {
        console.error("Lỗi cộng thưởng giới thiệu hội viên:", refErr);
      }
    }

    await customerPackage.save();

    await syncCustomerFields(customer._id);

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
          price: customerPackage.price,
          total: customerPackage.price,
        },
      ],
      subtotal: customerPackage.price,
      total: customerPackage.price,
      paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
      paymentStatus: customerPackage.paymentStatus,
      staff: req.user ? req.user._id : undefined,
    });

    await Transaction.create({
      type: "package_purchase",
      amount: customerPackage.paidAmount || 0,
      paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
      customer: customer._id,
      customerName: customer.name,
      customerPackage: customerPackage._id,
      status: "success",
      staff: req.user ? req.user._id : undefined,
    });

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

    // Gửi tin nhắn Zalo OA giả lập
    if (customer.phone) {
      try {
        await sendZaloNotification({
          phone: customer.phone,
          message: `Chúc mừng ${customer.name} đã đăng ký thành công gói tập ${customerPackage.packageName}. Thời hạn gói: từ ${new Date(customerPackage.startDate).toLocaleDateString("vi-VN")} đến ${new Date(customerPackage.endDate).toLocaleDateString("vi-VN")}. Hân hạnh được phục vụ quý khách!`,
          type: "package_purchase"
        });
      } catch (zErr) {
        console.error("Lỗi gửi tin nhắn Zalo OA khi mua gói tập:", zErr);
      }
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

    // Thực hiện xóa mềm gói tập
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
        console.log(`Đã xóa mềm hồ sơ khách hàng gốc ${customerId} vì không còn gói tập nào hoạt động`);
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

    if (customerPackage.status !== "active") {
      return res.status(400).json({ message: `Gói tập hiện tại ở trạng thái "${customerPackage.status}", không thể đóng băng.` });
    }

    const { startDate, endDate, reason } = req.body;
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

    customerPackage.status = "frozen";
    customerPackage.frozenPeriods.push({
      startDate: start,
      endDate: end,
      reason: reason || "Khách hàng yêu cầu tạm ngưng",
    });

    await customerPackage.save();

    await syncCustomerFields(customerPackage.customer);

    res.status(200).json({
      success: true,
      message: "Tạm dừng gói tập thành công, hạn gói đã được cộng thêm thời gian bảo lưu dự kiến.",
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

module.exports = {
  getAll: getAllCustomers,
  create: createCustomer,
  delete: deleteCustomer,
  update: updateCustomer,
  freeze: freezeCustomer,
  unfreeze: unfreezeCustomer,
  enrollFace,
  checkExisting: checkExistingCustomer,
};
