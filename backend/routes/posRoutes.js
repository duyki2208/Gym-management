const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { protect } = require('../middleware/authMiddleware');
const { PERMISSIONS, requirePermission } = require('../middleware/permissions');

const { verifySepayWebhook } = require('../middleware/webhookVerifier');

router.post('/checkout', protect, posController.createCheckout);
router.get('/sales', protect, posController.getSales);
router.get('/order-status/:id', protect, posController.getOrderStatus);
router.patch(
  '/orders/:id/confirm',
  protect,
  requirePermission(PERMISSIONS.PAYMENT_CONFIRM),
  posController.confirmPayment
);
router.patch(
  '/orders/:id/cancel',
  protect,
  requirePermission(PERMISSIONS.PAYMENT_CANCEL),
  posController.cancelOrder
);

// Webhook nhận biến động số dư SePay (không qua protect/JWT mà xác thực qua verifySepayWebhook)
router.post('/webhook', verifySepayWebhook, posController.handleWebhook);

module.exports = router;
