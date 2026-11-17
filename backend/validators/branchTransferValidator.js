const { body, header } = require("express-validator");

module.exports = [
  body("customerId").isMongoId().withMessage("customerId không hợp lệ"),
  body("packageId").optional().isMongoId().withMessage("packageId không hợp lệ"),
  body("targetBranchCode").isString().bail().trim().matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/i),
  body("transferFee").optional().custom(value => Number.isSafeInteger(value) && value >= 0)
    .withMessage("Phí chuyển phải là số nguyên VNĐ không âm"),
  body("paymentMethod").optional().isString().bail().trim().isLength({ min: 1, max: 80 }),
  body("note").optional().isString().bail().isLength({ max: 2000 }),
  header("Idempotency-Key").optional().matches(/^[A-Za-z0-9._:-]{1,200}$/),
  body().custom((_value, { req }) => Boolean(req.body?.packageId || req.headers["idempotency-key"]))
    .withMessage("Cần packageId hoặc Idempotency-Key để gửi lại yêu cầu an toàn"),
];
