const express = require("express");
const router = express.Router();
const { loginUser } = require("../controllers/authController");

// Đăng nhập
router.post("/login", loginUser);

module.exports = router;
