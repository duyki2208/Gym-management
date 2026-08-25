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

// GET /api/v1/auth/branches — Lấy danh sách chi nhánh hoạt động
router.get("/branches", async (req, res) => {
  try {
    const centralModels = req.centralModels || (await require("../db/branchConnectionManager").getCentralModels());
    const branches = await centralModels.Branch.find({ isActive: true }).select("code name address phone hotline");
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/auth/logout — Xóa Session của thiết bị hiện tại (cần protect để lấy req.user)
router.post("/logout", protect, logoutUser);

module.exports = router;
