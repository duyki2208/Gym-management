const Customer = require("../models/Customer");

// Thêm khách hàng mới (validate dữ liệu đầu vào)
const createCustomer = async (req, res) => {
  console.log("--- Executing: createCustomer controller ---");
  try {
    const requiredFields = ["name", "phone", "packageType", "endDate"];
    const missing = requiredFields.filter((f) => !req.body[f]);
    if (missing.length > 0) {
      return res
        .status(400)
        .json({ message: `Thiếu trường: ${missing.join(", ")}` });
    }

    // Xử lý ngày tháng - chuyển string thành Date object
    const customerData = { ...req.body };

    // Xử lý dob
    if (customerData.dob) {
      if (typeof customerData.dob === "string") {
        const dobDate = new Date(customerData.dob);
        customerData.dob = isNaN(dobDate.getTime()) ? undefined : dobDate;
      } else if (customerData.dob instanceof Date) {
        // Đã là Date object, giữ nguyên
      }
    }

    // Xử lý startDate
    if (customerData.startDate) {
      if (typeof customerData.startDate === "string") {
        const startDate = new Date(customerData.startDate);
        customerData.startDate = isNaN(startDate.getTime())
          ? new Date()
          : startDate;
      } else if (customerData.startDate instanceof Date) {
        // Đã là Date object, giữ nguyên
      }
    } else {
      customerData.startDate = new Date(); // Mặc định là ngày hiện tại
    }

    // Xử lý endDate (bắt buộc)
    if (customerData.endDate) {
      if (typeof customerData.endDate === "string") {
        const endDate = new Date(customerData.endDate);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ message: "Ngày hết hạn không hợp lệ" });
        }
        customerData.endDate = endDate;
      } else if (customerData.endDate instanceof Date) {
        // Đã là Date object, giữ nguyên
      }
    }

    const customer = new Customer(customerData);
    const saved = await customer.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(400).json({ message: error.message || "Lỗi tạo khách hàng" });
  }
};

// Lấy tất cả khách hàng (có phân trang, tìm kiếm, lọc)
const getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;
    
    const query = {};

    // 1. Tìm kiếm (Tên hoặc SĐT)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // 2. Lọc theo trạng thái
    const now = new Date();
    // Reset giờ về 0 để so sánh chính xác theo ngày nếu cần, 
    // nhưng so sánh timestamp trực tiếp cũng ổn cho expiry.
    
    if (status === "active") {
        query.endDate = { $gte: now };
    } else if (status === "expired") {
        query.endDate = { $lt: now };
    } else if (status === "expiring") {
        // Sắp hết hạn: Trong vòng 14 ngày tới VÀ chưa hết hạn
        const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        query.endDate = { $gte: now, $lte: fourteenDaysLater };
    }

    // 3. Đếm tổng số lượng (để tính số trang)
    const totalCustomers = await Customer.countDocuments(query);

    // 4. Lấy dữ liệu phân trang
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 }) // Mới nhất lên đầu
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      customers,
      totalCustomers,
      totalPages: Math.ceil(totalCustomers / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa khách hàng
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (customer) {
      await customer.deleteOne(); // Hoặc customer.remove() tùy phiên bản Mongoose
      res.json({ message: "Khách hàng đã được xóa" });
    } else {
      res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật khách hàng
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Cập nhật tất cả các trường từ req.body
    const updateData = { ...req.body };

    // Xử lý ngày tháng nếu là string
    if (updateData.dob && typeof updateData.dob === "string") {
      updateData.dob = new Date(updateData.dob);
    }
    if (updateData.startDate && typeof updateData.startDate === "string") {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate && typeof updateData.endDate === "string") {
      updateData.endDate = new Date(updateData.endDate);
    }

    // Loại bỏ _id và id nếu có
    delete updateData._id;
    delete updateData.id;

    // Cập nhật từng trường
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        customer[key] = updateData[key];
      }
    });

    const updatedCustomer = await customer.save();
    res.json(updatedCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAll: getAllCustomers, // Export với tên 'getAll' để khớp với router.get('/', ..., customerController.getAll)
  create: createCustomer,
  delete: deleteCustomer,
  update: updateCustomer,
};
