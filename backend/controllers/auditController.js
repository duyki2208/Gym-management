const AuditLog = require("../models/AuditLog");
const asyncHandler = require("../middleware/asyncHandler");
const { sanitizeAuditRecord } = require("../utils/auditSanitizer");
const { literalSearch, pagination, QUERY_TIMEOUT_MS } = require("../utils/queryLimits");

// @desc    Lấy danh sách nhật ký hệ thống
// @route   GET /api/v1/audit-logs
// @access  Private (Admin, Manager)
const getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 10);
  const search = literalSearch(req.query.search);

  const query = {};

  // Tìm kiếm theo tên nhân viên, hành động hoặc phương thức
  if (search) {
    const searchRegex = new RegExp(search, "i");
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

  const totalLogs = await AuditLog.countDocuments(query).maxTimeMS(QUERY_TIMEOUT_MS);
  const logs = await AuditLog.find(query)
    .populate("user", "name role email")
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit).maxTimeMS(QUERY_TIMEOUT_MS);

  res.status(200).json({
    success: true,
    data: {
      // Historical rows may predate write-time redaction.
      logs: logs.map(sanitizeAuditRecord),
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
    },
    message: "Lấy danh sách nhật ký hệ thống thành công",
  });
});

module.exports = { getAuditLogs };
