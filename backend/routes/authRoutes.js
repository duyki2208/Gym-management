const express = require("express");
const router = express.Router();
const {
  loginUser,
  refreshToken,
  switchBranch,
  logoutUser,
} = require("../controllers/authController");
const { loginValidator } = require("../validators/authValidator");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/authMiddleware");

// POST /api/v1/auth/login
router.post("/login", loginValidator, validate, loginUser);

// POST /api/v1/auth/refresh-token — Cấp Access Token mới (không cần protect, cookie tự gửi kèm)
router.post("/refresh-token", refreshToken);

// POST /api/v1/auth/switch-branch — Đổi chi nhánh làm việc (cho admin / accountant)
router.post("/switch-branch", protect, switchBranch);

// GET /api/v1/auth/branches — Chỉ user đã xác thực mới được lấy danh sách chi nhánh
router.get("/branches", protect, async (req, res) => {
  try {
    if (!req.user?.isCentral) {
      return res.status(403).json({
        success: false,
        code: "BRANCH_LIST_FORBIDDEN",
        message: "Bạn không có quyền truy cập tài nguyên này.",
      });
    }

    const centralModels = req.centralModels || (await require("../db/branchConnectionManager").getCentralModels());
    const allowedBranches = Array.isArray(req.user.allowedBranches)
      ? req.user.allowedBranches
      : [];
    const branchFilter = allowedBranches.includes("*")
      ? { isActive: true }
      : { isActive: true, code: { $in: allowedBranches } };
    const branches = await centralModels.Branch.find(branchFilter).select("code name address phone hotline");
    res.json({ success: true, branches });
  } catch (err) {
    console.error("Lỗi lấy danh sách chi nhánh:", err);
    res.status(500).json({ success: false, message: "Không thể tải danh sách chi nhánh." });
  }
});

// POST /api/v1/auth/logout — Xóa Session của thiết bị hiện tại (cần protect để lấy req.user)
router.post("/logout", protect, logoutUser);

module.exports = router;
