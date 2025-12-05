const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Models
const Customer = require("./models/Customer");
const CheckIn = require("./models/CheckIn");
const Staff = require("./models/Staff");

// Cấu hình
dotenv.config();
connectDB(); // Kết nối MongoDB

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---
// Route cho gói tập
const packageRoutes = require("./routes/packageRoutes");
app.use("/api/packages", packageRoutes);

// Test Route để xem server chạy chưa
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 1. Lấy danh sách khách hàng
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Thêm khách hàng mới
app.post("/api/customers", async (req, res) => {
  try {
    let { name, code, phone, packageType, endDate, trainer, ...otherData } =
      req.body;

    // Tự động tạo mã khách hàng nếu không có hoặc rỗng
    if (!code || code === "" || code === "Tự động tạo") {
      const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
      const lastNumber = lastCustomer
        ? parseInt(lastCustomer.code?.replace("KH", "") || "0")
        : 0;
      code = `KH${String(lastNumber + 1).padStart(5, "0")}`;
    }

    // Kiểm tra mã đã tồn tại chưa
    const customerExists = await Customer.findOne({ code });
    if (customerExists) {
      return res.status(400).json({ message: "Mã khách hàng đã tồn tại" });
    }

    // Chuẩn bị dữ liệu, đảm bảo trainer là string và xử lý các trường khác
    const customerData = {
      name,
      code,
      phone,
      packageType,
      endDate: endDate ? new Date(endDate) : null,
      trainer: trainer ? String(trainer) : "",
      ...otherData,
    };

    // Xóa các trường undefined để tránh lỗi
    Object.keys(customerData).forEach((key) => {
      if (customerData[key] === undefined) {
        delete customerData[key];
      }
    });

    const customer = await Customer.create(customerData);
    res.status(201).json(customer);
  } catch (error) {
    console.error("Lỗi tạo khách hàng:", error);
    res.status(400).json({ message: error.message });
  }
});

// 3. Cập nhật khách hàng
app.put("/api/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { trainer, ...updateData } = req.body;

    // Không cho phép thay đổi mã khách hàng
    delete updateData.code;

    // Đảm bảo trainer là string
    if (trainer !== undefined) {
      updateData.trainer =
        typeof trainer === "string" ? trainer : trainer ? String(trainer) : "";
    }

    const customer = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Lỗi cập nhật khách hàng:", error);
    res.status(400).json({ message: error.message });
  }
});

// 4. Xóa khách hàng
app.delete("/api/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (customer) {
      await customer.deleteOne();
      res.json({ message: "Đã xóa khách hàng" });
    } else {
      res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Check-in khách hàng
app.post("/api/checkins", async (req, res) => {
  const { customerId, customerName, customerCode, packageType } = req.body;
  try {
    const checkIn = await CheckIn.create({
      customerId,
      customerName,
      customerCode,
      packageType,
    });
    res.status(201).json(checkIn);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 6. Lấy lịch sử Check-in
app.get("/api/checkins", async (req, res) => {
  try {
    const checkins = await CheckIn.find({}).sort({ time: -1 }).limit(100);
    res.json(checkins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7. Lấy danh sách nhân viên
app.get("/api/staff", async (req, res) => {
  try {
    const staffList = await Staff.find({}).sort({ createdAt: -1 });
    res.json(staffList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 8. Thêm nhân viên mới
app.post("/api/staff", async (req, res) => {
  try {
    const staff = await Staff.create(req.body);
    res.status(201).json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 9. Cập nhật nhân viên
app.put("/api/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    res.json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 10. Xóa nhân viên
app.delete("/api/staff/:id", async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (staff) {
      await staff.deleteOne();
      res.json({ message: "Đã xóa nhân viên" });
    } else {
      res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
