const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { PERMISSIONS, requirePermission } = require('../middleware/permissions');

router.use(protect);

router.post(
  '/import',
  requirePermission(PERMISSIONS.INVENTORY_IMPORT),
  inventoryController.createImport
);
router.get(
  '/imports',
  requirePermission(PERMISSIONS.INVENTORY_READ),
  inventoryController.getImports
);

module.exports = router;
