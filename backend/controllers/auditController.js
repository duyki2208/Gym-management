const AuditLog = require("../models/AuditLog");
const asyncHandler = require("../middleware/asyncHandler");

// @desc    Lấy danh sách nhật ký hệ thống
// @route   GET /api/v1/audit-logs
// @access  Private (Admin, Manager)
const getAuditLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  // Tìm kiếm theo tên nhân viên, hành động hoặc phương thức
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, "i");
    query.$or = [
      { username: searchRegex },
      { action: searchRegex },
      { method: searchRegex },
    ];
  }

  // Lọc theo phương thức HTTP (POST, PUT, DELETE)
  if (req.query.method && req.query.method !== "all") {
    query.method = req.query.method;
  }

  const totalLogs = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate("user", "name role email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    data: {
      logs,
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
    },
    message: "Lấy danh sách nhật ký hệ thống thành công",
  });
});

module.exports = { getAuditLogs };
