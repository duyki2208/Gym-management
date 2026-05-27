const ImportOrder = require('../models/ImportOrder');
const Product = require('../models/Product');

exports.createImport = async (req, res) => {
  try {
    const { supplier, details, note } = req.body;
    let totalAmount = 0;
    
    const importOrder = new ImportOrder({
      supplier,
      details: [],
      note
    });

    for (const item of details) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stockQuantity += item.quantity;
        // Cập nhật giá nhập gần nhất nếu có thay đổi
        if (item.importPrice > 0) {
            product.importPrice = item.importPrice; 
        }
        await product.save();
        
        totalAmount += (item.quantity * item.importPrice);
        importOrder.details.push({
          product: product._id,
          quantity: item.quantity,
          importPrice: item.importPrice
        });
      }
    }
    
    importOrder.totalAmount = totalAmount;
    await importOrder.save();

    res.status(201).json({ message: 'Nhập kho thành công', importOrder });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi nhập kho', error: error.message });
  }
};

exports.getImports = async (req, res) => {
  try {
    const imports = await ImportOrder.find()
      .populate('details.product', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(imports);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách nhập kho', error: error.message });
  }
};
