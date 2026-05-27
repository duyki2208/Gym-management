/**
 * middleware/validate.js — Middleware bắt lỗi validation dùng chung
 * Sử dụng sau express-validator check() rules trong route.
 *
 * Ví dụ dùng:
 *   router.post('/login', [...authValidator], validate, loginUser);
 */
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = validate;
