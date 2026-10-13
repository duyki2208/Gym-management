const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { PERMISSIONS, requirePermission } = require('../middleware/permissions');

// Product data is branch-scoped and must never be resolved for an anonymous request.
router.use(protect);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', requirePermission(PERMISSIONS.PRODUCT_MANAGE), productController.createProduct);
router.put('/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), productController.updateProduct);
router.delete('/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), productController.deleteProduct);

module.exports = router;
