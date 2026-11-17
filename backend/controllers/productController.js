const Product = require('../models/Product');
const { literalSearch, pagination, QUERY_TIMEOUT_MS, queryError } = require('../utils/queryLimits');

// Lấy danh sách sản phẩm (có hỗ trợ tìm kiếm theo tên)
exports.getProducts = async (req, res) => {
  try {
    const search = literalSearch(req.query.search);
    const { page, limit, skip } = pagination(req.query, 100);
    let query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const total = await Product.countDocuments(query).maxTimeMS(QUERY_TIMEOUT_MS);
    const products = await Product.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).maxTimeMS(QUERY_TIMEOUT_MS);
    res.set('X-Total-Pages', String(Math.max(1, Math.ceil(total / limit))));
    res.set('X-Total-Count', String(total));
    res.set('X-Page', String(page));
    res.status(200).json(products);
  } catch (error) {
    queryError(res, error, 'Lỗi khi lấy danh sách sản phẩm');
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống', error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo sản phẩm', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm', error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.status(200).json({ message: 'Đã xóa sản phẩm thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xoá sản phẩm', error: error.message });
  }
};
