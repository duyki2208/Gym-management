const express = require("express");
const router = express.Router();
const {
  loginUser,
  refreshToken,
  logoutUser,
} = require("../controllers/authController");
const { loginValidator } = require("../validators/authValidator");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/authMiddleware");

// POST /api/v1/auth/login
router.post("/login", loginValidator, validate, loginUser);

// POST /api/v1/auth/refresh-token — Cấp Access Token mới (không cần protect, cookie tự gửi kèm)
router.post("/refresh-token", refreshToken);

// POST /api/v1/auth/logout — Xóa Session của thiết bị hiện tại (cần protect để lấy req.user)
router.post("/logout", protect, logoutUser);

module.exports = router;
