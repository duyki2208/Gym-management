const express = require("express");
const router = express.Router();
const { loginUser } = require("../controllers/authController");
const { loginValidator } = require("../validators/authValidator");
const validate = require("../middleware/validate");

// POST /api/v1/auth/login
router.post("/login", loginValidator, validate, loginUser);

module.exports = router;
