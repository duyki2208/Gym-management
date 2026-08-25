/**
 * backend/controllers/staffController.js
 * Quản lý nhân viên chi nhánh với cơ chế Dual-Write (Branch DB User + Central LoginIndex)
 */
const bcrypt = require("bcryptjs");

// Lấy tất cả nhân viên của chi nhánh
const getAll = async (req, res) => {
  try {
    const User = req.models.User;
    const Customer = req.models.Customer;

    const staff = await User.find({
      role: { $in: ["manager", "pt", "sale", "reception", "accountant", "sm", "pm", "om"] },
    }).lean();

    const now = new Date();
    // Đếm số KH phụ trách hiện tại
    const staffWithCounts = await Promise.all(
      staff.map(async (user) => {
        const activeCustomersCount = await Customer.countDocuments({
          assignedStaff: user._id,
          endDate: { $gte: now },
        });
        return { ...user, activeCustomersCount };
      })
    );

    res.json(staffWithCounts);
  } catch (error) {
    console.error("Lỗi getAll staff:", error);
    res.status(500).json({ message: "Lỗi lấy danh sách nhân viên: " + error.message });
  }
};

// Tạo mới nhân viên (Dual-Write: Branch User + Central LoginIndex)
const create = async (req, res) => {
  let createdUser = null;
  try {
    const { username, password, fullName, role, dob, phone, specialty, isActive = true } = req.body;
    const allowedRoles = ["sm", "pm", "om", "pt", "sale", "reception"];

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

    const User = req.models.User;
    const centralModels = req.centralModels;

    // 1. Kiểm tra trùng username trên Central LoginIndex và CentralUser
    const existsInLoginIndex = await centralModels.LoginIndex.findOne({ username });
    const existsInCentral = await centralModels.CentralUser.findOne({ username });
    const existsInBranch = await User.findOne({ username });

    if (existsInLoginIndex || existsInCentral || existsInBranch) {
      return res.status(400).json({ message: "Tên đăng nhập (username) đã tồn tại trong hệ thống!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let dobDate = dob;
    if (dob && typeof dob === "string") {
      dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        dobDate = undefined;
      }
    }

    // 2. Ghi vào Branch DB (User)
    createdUser = new User({
      username,
      password: hashedPassword,
      fullName: fullName || username,
      role,
      dob: dobDate,
      phone,
      specialty,
      isActive,
    });
    await createdUser.save();

    // 3. Ghi vào Central DB (LoginIndex)
    try {
      await centralModels.LoginIndex.create({
        username,
        branchCode: req.branchCode,
        role,
        userId: createdUser._id,
      });
    } catch (centralErr) {
      // Rollback bước 2 nếu ghi Central DB thất bại
      console.error("[DualWrite Rollback] Xóa Branch User do lỗi ghi LoginIndex:", centralErr);
      await User.findByIdAndDelete(createdUser._id);
      throw new Error(`Lỗi đồng bộ danh mục trung tâm: ${centralErr.message}`);
    }

    res.status(201).json(createdUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Sửa thông tin nhân viên
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, fullName, role, dob, phone, specialty, isActive } = req.body;
    const User = req.models.User;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (role) {
      const allowedRoles = ["sm", "pm", "om", "pt", "sale", "reception"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Không thể cập nhật chức vụ thành Admin hoặc Kế toán!" });
      }
      updateData.role = role;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (specialty !== undefined) updateData.specialty = specialty;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

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

    // Cập nhật role trong LoginIndex nếu có thay đổi
    if (role && req.centralModels) {
      await req.centralModels.LoginIndex.updateOne(
        { username: staff.username },
        { $set: { role } }
      ).catch((e) => console.warn(`Lỗi cập nhật role LoginIndex: ${e.message}`));
    }

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message || "Lỗi cập nhật nhân viên" });
  }
};

// Xóa nhân viên (Xóa cả User ở Branch DB và LoginIndex ở Central DB)
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const User = req.models.User;
    const staff = await User.findById(id);

    if (staff) {
      if (req.centralModels) {
        await req.centralModels.LoginIndex.deleteOne({ username: staff.username }).catch((e) =>
          console.warn(`Lỗi xóa LoginIndex: ${e.message}`)
        );
      }
      await User.findByIdAndDelete(id);
    }

    res.json({ message: "Đã xóa nhân viên thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xóa nhân viên: " + error.message });
  }
};

// Lấy lịch làm việc của nhân viên
const getSchedules = async (req, res) => {
  try {
    const Schedule = req.models.Schedule;
    const { startDate, endDate, date } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (date) {
      query.date = date;
    }

    const schedules = await Schedule.find(query).populate("staff", "fullName name role").lean();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy lịch làm việc: " + error.message });
  }
};

// Cập nhật/Thêm lịch làm việc
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, shiftType } = req.body;
    const User = req.models.User;
    const Schedule = req.models.Schedule;

    if (!date || !shiftType) {
      return res.status(400).json({ message: "Thiếu ngày (date) hoặc ca làm (shiftType)" });
    }

    const targetStaff = await User.findById(id);
    if (!targetStaff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    const currentUserRole = req.user ? req.user.role : null;
    const isSelf = req.user && req.user._id.toString() === id;
    let hasPermission = false;

    if (isSelf) {
      hasPermission = true;
    } else if (currentUserRole === "admin" || currentUserRole === "accountant") {
      hasPermission = true;
    } else if (currentUserRole === "sm" && (targetStaff.role === "sale" || targetStaff.role === "sm")) {
      hasPermission = true;
    } else if (currentUserRole === "pm" && (targetStaff.role === "pt" || targetStaff.role === "pm")) {
      hasPermission = true;
    } else if (currentUserRole === "om" && (targetStaff.role === "reception" || targetStaff.role === "om")) {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật lịch làm việc cho nhân viên thuộc bộ phận này!",
      });
    }

    const schedule = await Schedule.findOneAndUpdate(
      { staff: id, date: date },
      { shiftType: shiftType },
      { new: true, upsert: true }
    );
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật lịch làm việc: " + error.message });
  }
};

module.exports = { getAll, create, update, remove, getSchedules, updateSchedule };
