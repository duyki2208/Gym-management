const CheckIn = require("../models/CheckIn");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");

// Lấy tất cả lịch sử check-in
const getAll = async (req, res) => {
  try {
    const checkins = await CheckIn.find().sort({ time: -1 });
    res.json(checkins);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy lịch sử check-in" });
  }
};

// Tạo mới check-in
const create = async (req, res) => {
  try {
    const { customerId, time } = req.body;
    if (!customerId)
      return res.status(400).json({ message: "Thiếu customerId" });
    
    let customer = await Customer.findById(customerId);
    if (!customer) {
      // Fallback nếu client truyền lên ID gói tập thay vì ID hội viên
      const pkg = await CustomerPackage.findById(customerId);
      if (pkg && pkg.customer) {
        customer = await Customer.findById(pkg.customer);
      }
    }

    if (!customer)
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    const checkin = new CheckIn({
      customerId: customer._id,
      customerName: customer.name,
      customerCode: customer.code,
      packageType: customer.packageType,
      time: time || new Date(),
    });
    await checkin.save();
    res.status(201).json(checkin);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo check-in" });
  }
};

module.exports = { getAll, create };
