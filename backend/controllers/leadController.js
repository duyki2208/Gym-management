const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const User = require("../models/User");

// @desc    Lấy tất cả Leads (tìm kiếm & lọc)
// @route   GET /api/v1/leads
const getAllLeads = async (req, res) => {
  try {
    const { search, status, source, assignedSale } = req.query;
    const query = {};

    if (status) query.status = status;
    if (source) query.source = source;
    if (assignedSale) query.assignedSale = assignedSale;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query)
      .populate("assignedSale", "fullName username role")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: leads });
  } catch (error) {
    console.error("Lỗi lấy danh sách leads:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Tạo mới Lead
// @route   POST /api/v1/leads
const createLead = async (req, res) => {
  try {
    const { name, phone, email, source, assignedSale, note } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Tên và số điện thoại là bắt buộc" });
    }

    const notesList = [];
    if (note) {
      notesList.push({
        note,
        date: new Date(),
        author: req.user ? req.user.fullName || req.user.username : "System",
      });
    }

    const newLead = await Lead.create({
      name,
      phone,
      email: email || "",
      source: source || "other",
      assignedSale: assignedSale || undefined,
      notes: notesList,
    });

    res.status(201).json({ success: true, data: newLead, message: "Tạo khách hàng tiềm năng thành công" });
  } catch (error) {
    console.error("Lỗi tạo lead:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Cập nhật Lead (thông tin + ghi chú chăm sóc)
// @route   PUT /api/v1/leads/:id
const updateLead = async (req, res) => {
  try {
    const { name, phone, email, source, status, assignedSale, note } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng tiềm năng" });
    }

    if (name) lead.name = name;
    if (phone) lead.phone = phone;
    if (email !== undefined) lead.email = email;
    if (source) lead.source = source;
    if (status) lead.status = status;
    if (assignedSale !== undefined) lead.assignedSale = assignedSale || null;

    if (note) {
      lead.notes.push({
        note,
        date: new Date(),
        author: req.user ? req.user.fullName || req.user.username : "System",
      });
    }

    await lead.save();
    res.json({ success: true, data: lead, message: "Cập nhật thành công" });
  } catch (error) {
    console.error("Lỗi cập nhật lead:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Chuyển đổi Lead thành Customer
// @route   POST /api/v1/leads/:id/convert
const convertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng tiềm năng" });
    }

    if (lead.status === "converted") {
      return res.status(400).json({ success: false, message: "Khách hàng này đã được chuyển đổi trước đó" });
    }

    // Trả thông tin lead về để frontend điền vào form đăng ký hội viên
    lead.status = "converted";
    lead.notes.push({
      note: "Đã chuyển đổi thành hội viên chính thức",
      date: new Date(),
      author: req.user ? req.user.fullName || req.user.username : "System",
    });
    await lead.save();

    res.json({
      success: true,
      data: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        assignedStaff: lead.assignedSale,
      },
      message: "Lead đã chuyển đổi trạng thái thành công, chuyển hướng tới form đăng ký",
    });
  } catch (error) {
    console.error("Lỗi chuyển đổi lead:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Xóa Lead
// @route   DELETE /api/v1/leads/:id
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng tiềm năng" });
    }
    res.json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("Lỗi xóa lead:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

module.exports = {
  getAllLeads,
  createLead,
  updateLead,
  convertLead,
  deleteLead,
};
