const { body } = require('express-validator');

/**
 * authValidator — Validation rules cho auth endpoints
 */
const loginValidator = [
  body('facilityKey')
    .trim()
    .notEmpty().withMessage('Mã cơ sở không được để trống')
    .isLength({ min: 3, max: 64 }).withMessage('Mã cơ sở không hợp lệ')
    .matches(/^[A-Za-z0-9][A-Za-z0-9-]*$/).withMessage('Mã cơ sở không hợp lệ'),

  body('username')
    .trim()
    .notEmpty().withMessage('Tên đăng nhập không được để trống')
    .isLength({ max: 100 }).withMessage('Tên đăng nhập không hợp lệ'),

  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ max: 128 }).withMessage('Mật khẩu không hợp lệ'),
];

module.exports = { loginValidator };
