const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const { CUSTOMER_STATUS } = require("../utils/constants");
const { sendRegistrationEmail } = require("../utils/emailService");
const mongoose = require("mongoose");

async function syncCustomerFields(customerId) {
  try {
    let activePackage = await CustomerPackage.findOne({ customer: customerId, status: "active" }).sort({ endDate: -1 });
    if (!activePackage) {
      activePackage = await CustomerPackage.findOne({ customer: customerId }).sort({ createdAt: -1 });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return;

    if (activePackage) {
      customer.activePackage = activePackage._id;
      customer.packageType = activePackage.packageName;
      customer.startDate = activePackage.startDate;
      customer.endDate = activePackage.endDate;
      customer.remainingSessions = activePackage.remainingSessions;
      customer.price = activePackage.price;
      customer.paymentStatus = activePackage.paymentStatus;
      customer.paidAmount = activePackage.paidAmount;
      customer.contractType = activePackage.contractType;
      customer.trainer = activePackage.trainer;
      customer.assignedStaff = activePackage.assignedStaff;
      customer.hasLocker = activePackage.hasLocker;
      customer.hasWater = activePackage.hasWater;
      customer.packageNote = activePackage.packageNote;
    } else {
      customer.activePackage = null;
      customer.packageType = "Không có";
      customer.startDate = new Date();
      customer.endDate = new Date();
      customer.remainingSessions = 0;
      customer.price = 0;
      customer.paymentStatus = "unpaid";
      customer.paidAmount = 0;
      customer.packageNote = "";
    }
    await customer.save();
  } catch (err) {
    console.error("Lỗi đồng bộ hồ sơ khách hàng:", err);
  }
}

function flattenPackage(pkg) {
  if (!pkg) return null;
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
    
    packageType: pkg.packageName,
    startDate: pkg.startDate,
    endDate: pkg.endDate,
    price: pkg.price,
    remainingSessions: pkg.remainingSessions,
    trainer: pkg.trainer,
    assignedStaff: pkg.assignedStaff,
    hasLocker: pkg.hasLocker,
    hasWater: pkg.hasWater,
    contractType: pkg.contractType,
    paymentStatus: pkg.paymentStatus,
    paidAmount: pkg.paidAmount,
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
      faceDescriptor,
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

    if (!customer) {
      customer = new Customer({
        name,
        phone,
        dob: parsedDob || undefined,
        gender,
        address,
        avatar,
        email,
        healthNote,
        faceDescriptor,
        packageType,
        packageNote: packageNote || "",
        endDate: new Date(endDate),
      });
      await customer.save();
      console.log(`Đã tạo hồ sơ khách hàng mới: ${customer.code}`);
    } else {
      console.log(`Tìm thấy hồ sơ khách hàng cũ. Sử dụng lại mã: ${customer.code}`);
      if (faceDescriptor && faceDescriptor.length > 0) customer.faceDescriptor = faceDescriptor;
      if (email) customer.email = email;
      if (healthNote) customer.healthNote = healthNote;
      if (avatar) customer.avatar = avatar;
      await customer.save();
    }

    const customerPackage = new CustomerPackage({
      customer: customer._id,
      packageName: packageType,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      price: price || 0,
      contractCode: contractCode || "HĐ-CŨ",
      packageNote: packageNote || "",
      remainingSessions: remainingSessions || 0,
      trainer: trainer || "",
      assignedStaff: assignedStaff || undefined,
      hasLocker: hasLocker || false,
      hasWater: hasWater || false,
      contractType: contractType || "new",
      paymentStatus: paymentStatus || "paid",
      paidAmount: paidAmount || 0,
      status: "active",
    });
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
      amount: customerPackage.paidAmount || customerPackage.price || 0,
      paymentMethod: customerPackage.paymentStatus === "paid" ? "Tiền mặt" : "Chuyển khoản QR",
      customer: customer._id,
      customerName: customer.name,
      customerPackage: customerPackage._id,
      status: "success",
      staff: req.user ? req.user._id : undefined,
    });

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

    const populatedPackage = await CustomerPackage.findById(customerPackage._id).populate("customer");
    res.status(201).json(flattenPackage(populatedPackage));
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
      .populate("customer")
      .populate("assignedStaff", "fullName role")
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

    const customerFields = ["name", "phone", "dob", "gender", "address", "avatar", "email", "healthNote", "faceDescriptor", "packageNote"];
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
        } else {
          customer[field] = updateData[field];
        }
      }
    });
    await customer.save();

    packageFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "packageType") {
          customerPackage.packageName = updateData[field];
        } else if ((field === "startDate" || field === "endDate") && typeof updateData[field] === "string") {
          customerPackage[field] = new Date(updateData[field]);
        } else {
          customerPackage[field] = updateData[field];
        }
      }
    });
    await customerPackage.save();

    await syncCustomerFields(customer._id);

    const updatedPopulated = await CustomerPackage.findById(customerPackage._id)
      .populate("customer")
      .populate("assignedStaff", "fullName role");

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
    await customerPackage.deleteOne();

    // Kiểm tra xem khách hàng này còn gói tập nào khác không
    const remainingPackagesCount = await CustomerPackage.countDocuments({ customer: customerId });
    if (remainingPackagesCount === 0) {
      const customer = await Customer.findById(customerId);
      if (customer) await customer.deleteOne();
      console.log(`Đã xóa hồ sơ khách hàng gốc ${customerId} vì không còn gói tập nào`);
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
      data: flattenPackage(await CustomerPackage.findById(customerPackage._id).populate("customer")),
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
      data: flattenPackage(await CustomerPackage.findById(customerPackage._id).populate("customer")),
    });
  } catch (error) {
    console.error("Lỗi kích hoạt lại gói tập:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAll: getAllCustomers,
  create: createCustomer,
  delete: deleteCustomer,
  update: updateCustomer,
  freeze: freezeCustomer,
  unfreeze: unfreezeCustomer,
};
