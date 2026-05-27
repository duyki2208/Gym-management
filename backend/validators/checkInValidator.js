const { body } = require('express-validator');

/**
 * checkInValidator — Validation rules cho check-in endpoints
 */
const createCheckInValidator = [
  body('customerId')
    .notEmpty().withMessage('ID khách hàng không được để trống')
    .isMongoId().withMessage('ID khách hàng không đúng định dạng'),

  body('method')
    .optional()
    .isIn(['face', 'manual', 'qr']).withMessage('Phương thức check-in không hợp lệ'),
];

module.exports = { createCheckInValidator };
