const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.post('/import', inventoryController.createImport);
router.get('/imports', inventoryController.getImports);

module.exports = router;
