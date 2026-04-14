const User = require("../models/User");
const Schedule = require("../models/Schedule");
const Customer = require("../models/Customer");

// Lấy tất cả nhân viên
const getAll = async (req, res) => {
  try {
    const staff = await User.find({
      role: { $in: ["manager", "pt", "sale", "reception"] },
    }).lean();

    const now = new Date();
    // Đếm số KH phụ trách hiện tại (có endDate >= now)
    const staffWithCounts = await Promise.all(staff.map(async (user) => {
      const activeCustomersCount = await Customer.countDocuments({
        assignedStaff: user._id,
        endDate: { $gte: now }
      });
      return { ...user, activeCustomersCount };
    }));

    res.json(staffWithCounts);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách nhân viên" });
  }
};

// Tạo mới nhân viên (validate dữ liệu đầu vào)
const create = async (req, res) => {
  try {
    const { username, password, fullName, role, dob, phone, specialty } =
      req.body;
    const allowedRoles = ["admin", "manager", "pt", "sale", "reception"];
    if (!username || !password || !role) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc (username, password, role)",
      });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: `Role không hợp lệ. Chỉ chấp nhận: ${allowedRoles.join(", ")}`,
      });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username đã tồn tại" });
    }
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Xử lý ngày sinh nếu là string
    let dobDate = dob;
    if (dob && typeof dob === "string") {
      dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        dobDate = undefined;
      }
    }

    const staff = new User({
      username,
      password: hashedPassword,
      fullName: fullName || username,
      role,
      dob: dobDate,
      phone,
      specialty,
    });
    await staff.save();
    res.status(201).json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Sửa thông tin nhân viên
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, fullName, role, dob, phone, specialty, ...otherData } =
      req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (specialty !== undefined) updateData.specialty = specialty;

    // Xử lý password nếu có
    if (password) {
      const bcrypt = require("bcryptjs");
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Xử lý ngày sinh
    if (dob !== undefined) {
      if (dob && typeof dob === "string") {
        const dobDate = new Date(dob);
        updateData.dob = isNaN(dobDate.getTime()) ? undefined : dobDate;
      } else if (dob) {
        updateData.dob = dob;
      } else {
        updateData.dob = undefined;
      }
    }

    const staff = await User.findByIdAndUpdate(id, updateData, { new: true });
    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }
    res.json(staff);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Lỗi cập nhật nhân viên" });
  }
};

// Xóa nhân viên
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: "Đã xóa nhân viên" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xóa nhân viên" });
  }
};

// Lấy lịch làm việc của tất cả nhân viên (tuỳ chọn lọc theo date)
const getSchedules = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (date) {
      query.date = date;
    }
    
    const schedules = await Schedule.find(query).populate('staff', 'fullName name role').lean();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy lịch làm việc" });
  }
};

// Cập nhật/Thêm lịch làm việc cho 1 nhân viên
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params; // Staff ID
    const { date, shiftType } = req.body;
    
    if (!date || !shiftType) {
      return res.status(400).json({ message: "Thiếu ngày (date) hoặc ca làm (shiftType)" });
    }
    
    const schedule = await Schedule.findOneAndUpdate(
      { staff: id, date: date },
      { shiftType: shiftType },
      { new: true, upsert: true }
    );
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật lịch làm việc" });
  }
};

module.exports = { getAll, create, update, remove, getSchedules, updateSchedule };
