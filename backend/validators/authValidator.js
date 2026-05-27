const { body } = require('express-validator');

/**
 * authValidator — Validation rules cho auth endpoints
 */
const loginValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('Tên đăng nhập không được để trống'),

  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống'),
];

module.exports = { loginValidator };

