/**
 * controllers/searchController.js — Global Search Endpoint
 *
 * Tìm kiếm song song trên nhiều collection:
 *  - Customer: name, phone, code
 *  - User (staff): fullName, username, phone
 *  - Package: name
 *  - Lead: name, phone
 *  - Product: name
 *
 * Query params:
 *  - q: từ khóa tìm kiếm (bắt buộc, min 1 ký tự)
 *  - categories: comma-separated (customers,staff,packages,leads,products)
 *                Mặc định: tìm tất cả
 *  - limit: số kết quả tối đa mỗi nhóm (mặc định 5)
 */

const Customer = require('../models/Customer');
const User = require('../models/User');
const Package = require('../models/Package');
const Lead = require('../models/Lead');
const Product = require('../models/Product');

// Các nhóm tìm kiếm hợp lệ
const ALL_CATEGORIES = ['customers', 'staff', 'packages', 'leads', 'products'];

const globalSearch = async (req, res) => {
  try {
    const { q, categories, limit = 5 } = req.query;

    // Validate query
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu từ khóa tìm kiếm (q)',
      });
    }

    const query = q.trim();
    const maxLimit = Math.min(parseInt(limit) || 5, 10); // Tối đa 10 mỗi nhóm

    // Parse categories filter
    const requestedCategories = categories
      ? categories.split(',').map(c => c.trim()).filter(c => ALL_CATEGORIES.includes(c))
      : ALL_CATEGORIES;

    // Regex tìm kiếm (không phân biệt hoa thường)
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Chạy song song — chỉ query category được yêu cầu
    const searchPromises = {};

    if (requestedCategories.includes('customers')) {
      searchPromises.customers = Customer.find({ name: regex })
        .select('_id name phone code packageType endDate status avatarUrl')
        .limit(maxLimit)
        .lean();
    }

    if (requestedCategories.includes('staff')) {
      searchPromises.staff = User.find({
        role: { $in: ['manager', 'pt', 'sale', 'reception', 'accountant', 'sm', 'pm', 'om'] },
        $or: [
          { fullName: regex },
          { username: regex },
          { phone: regex },
        ],
      })
        .select('_id fullName username role phone specialty')
        .limit(maxLimit)
        .lean();
    }

    if (requestedCategories.includes('packages')) {
      searchPromises.packages = Package.find({ name: regex })
        .select('_id name duration price type sessions')
        .limit(maxLimit)
        .lean();
    }

    if (requestedCategories.includes('leads')) {
      searchPromises.leads = Lead.find({
        $or: [
          { name: regex },
          { phone: regex },
          { email: regex },
        ],
      })
        .select('_id name phone status source createdAt')
        .limit(maxLimit)
        .lean();
    }

    if (requestedCategories.includes('products')) {
      searchPromises.products = Product.find({ name: regex })
        .select('_id name sellPrice stockQuantity unit')
        .limit(maxLimit)
        .lean();
    }

    // Chờ tất cả query hoàn thành
    const keys = Object.keys(searchPromises);
    const values = await Promise.allSettled(Object.values(searchPromises));

    const results = {};
    let total = 0;

    keys.forEach((key, i) => {
      const settled = values[i];
      const data = settled.status === 'fulfilled' ? (settled.value || []) : [];
      results[key] = data;
      total += data.length;
    });

    // Điền các category không được tìm về mảng rỗng
    ALL_CATEGORIES.forEach(cat => {
      if (!results[cat]) results[cat] = [];
    });

    return res.json({
      success: true,
      data: results,
      total,
      query,
    });
  } catch (err) {
    console.error('[SearchController] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tìm kiếm',
    });
  }
};

module.exports = { globalSearch };
