/**
 * routes/searchRoutes.js — Global Search Route
 *
 * GET /api/v1/search?q=abc&categories=customers,staff&limit=5
 */
const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

// Yêu cầu đăng nhập để tìm kiếm
router.get('/', protect, globalSearch);

module.exports = router;
