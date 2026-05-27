const { body } = require('express-validator');

/**
 * customerValidator — Validation rules cho customer endpoints
 * Dựa theo Customer schema: name, phone, packageType, endDate là required
 */
const createCustomerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Họ tên khách hàng không được để trống')
    .isLength({ max: 100 }).withMessage('Họ tên không được vượt quá 100 ký tự'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Số điện thoại không được để trống')
    .matches(/^[0-9]{9,11}$/).withMessage('Số điện thoại phải có 9–11 chữ số'),

  body('packageType')
    .trim()
    .notEmpty().withMessage('Loại gói tập không được để trống'),

  body('dob')
    .notEmpty().withMessage('Ngày tháng năm sinh không được để trống')
    .isISO8601().withMessage('Ngày tháng năm sinh phải đúng định dạng ngày'),

  body('contractCode')
    .trim()
    .notEmpty().withMessage('Mã hợp đồng không được để trống'),

  body('endDate')
    .notEmpty().withMessage('Ngày kết thúc gói không được để trống')
    .isISO8601().withMessage('Ngày kết thúc phải đúng định dạng ngày'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Email không đúng định dạng'),

  body('price')
    .optional()
    .isNumeric().withMessage('Giá tiền phải là số')
    .isFloat({ min: 0 }).withMessage('Giá tiền không được âm'),

  body('paymentStatus')
    .optional()
    .isIn(['paid', 'deposit', 'unpaid']).withMessage('Trạng thái thanh toán không hợp lệ'),

  body('contractType')
    .optional()
    .isIn(['new', 'renew', 'upgrade']).withMessage('Loại hợp đồng không hợp lệ'),
];

const updateCustomerValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ max: 100 }).withMessage('Họ tên không được vượt quá 100 ký tự'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{9,11}$/).withMessage('Số điện thoại phải có 9–11 chữ số'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Email không đúng định dạng'),

  body('price')
    .optional()
    .isNumeric().withMessage('Giá tiền phải là số')
    .isFloat({ min: 0 }).withMessage('Giá tiền không được âm'),

  body('paymentStatus')
    .optional()
    .isIn(['paid', 'deposit', 'unpaid']).withMessage('Trạng thái thanh toán không hợp lệ'),

  body('contractType')
    .optional()
    .isIn(['new', 'renew', 'upgrade']).withMessage('Loại hợp đồng không hợp lệ'),
];

module.exports = { createCustomerValidator, updateCustomerValidator };
