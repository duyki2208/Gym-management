const SaleOrder = require('../models/SaleOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');

exports.createCheckout = async (req, res) => {
  try {
    const { customerId, details, paymentMethod, note } = req.body;
    
    let isWalkIn = true;
    let validCustomerId = null;
    let totalAmount = 0;
    let cust = null;
    
    if (customerId) {
        cust = await Customer.findById(customerId);
        if (cust) {
            isWalkIn = false;
            validCustomerId = cust._id;
        }
    }

    // Xác định trạng thái ban đầu của hóa đơn POS
    // Nếu là Chuyển khoản QR, để trạng thái là 'Chờ thanh toán'
    // Nếu là Tiền mặt, chuyển thẳng sang 'Đã thanh toán'
    const status = paymentMethod === 'Chuyển khoản QR' ? 'Chờ thanh toán' : 'Đã thanh toán';

    const saleOrder = new SaleOrder({
      customer: validCustomerId,
      isWalkIn,
      paymentMethod,
      status,
      details: [],
      note
    });

    const invoiceItems = [];

    // Tính toán và trừ tồn kho
    for (const item of details) {
      const product = await Product.findById(item.product);
      if (product) {
        if (product.stockQuantity < item.quantity) {
             return res.status(400).json({ success: false, message: `Sản phẩm ${product.name} chỉ còn ${product.stockQuantity} trong kho.` });
        }
        product.stockQuantity -= item.quantity;
        await product.save();
        
        const itemTotal = item.quantity * product.sellPrice;
        totalAmount += itemTotal;
        
        saleOrder.details.push({
          product: product._id,
          quantity: item.quantity,
          sellPrice: product.sellPrice
        });

        invoiceItems.push({
          name: product.name,
          quantity: item.quantity,
          price: product.sellPrice,
          total: itemTotal
        });
      } else {
        return res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm` });
      }
    }

    saleOrder.totalAmount = totalAmount;
    await saleOrder.save();

    // Nếu thanh toán bằng Tiền mặt, tạo luôn Hóa đơn & Giao dịch
    if (status === 'Đã thanh toán') {
      await Transaction.create({
        type: 'pos_sale',
        amount: totalAmount,
        paymentMethod: 'Tiền mặt',
        customer: validCustomerId,
        customerName: cust ? cust.name : 'Khách Lẻ',
        saleOrder: saleOrder._id,
        status: 'success',
        staff: req.user ? req.user._id : null
      });

      await Invoice.create({
        customer: validCustomerId,
        customerName: cust ? cust.name : 'Khách Lẻ',
        customerPhone: cust ? cust.phone : '',
        type: 'pos',
        referenceId: saleOrder._id,
        items: invoiceItems,
        subtotal: totalAmount,
        total: totalAmount,
        paymentMethod: 'Tiền mặt',
        paymentStatus: 'paid',
        staff: req.user ? req.user._id : null
      });
    }

    res.status(201).json({ 
      success: true, 
      message: status === 'Đã thanh toán' ? 'Thanh toán thành công' : 'Đã tạo đơn hàng chờ thanh toán', 
      saleOrder 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi thanh toán', error: error.message });
  }
};

// @desc    Lấy trạng thái đơn hàng hiện tại
// @route   GET /api/v1/pos/order-status/:id
exports.getOrderStatus = async (req, res) => {
  try {
    const saleOrder = await SaleOrder.findById(req.params.id);
    if (!saleOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }
    res.status(200).json({ success: true, status: saleOrder.status });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi lấy trạng thái đơn hàng', error: error.message });
  }
};

// @desc    Webhook nhận thông báo biến động số dư chuyển khoản thực tế từ SePay / Casso / PayOS
// @route   POST /api/v1/pos/webhook
exports.handleWebhook = async (req, res) => {
  try {
    const body = req.body;
    
    // Một số cổng thanh toán như SePay truyền trực tiếp ở root, PayOS truyền trong data
    const content = body.content || body.description || (body.data && (body.data.description || body.data.content)) || '';
    const amount = body.amountIn || body.transferAmount || (body.data && body.data.amount) || 0;

    console.log(`[Webhook] Nhận thông báo giao dịch: "${content}", Số tiền: ${amount}`);

    // Sử dụng Regex tìm mã đơn hàng dạng GYM[OrderID_last8]
    // Ví dụ: GYM50C1DB8C
    const match = content.match(/GYM([A-F0-9]{8})/i);
    if (!match) {
      return res.status(200).json({ success: false, message: 'Nội dung chuyển khoản không khớp định dạng GYMxxxxx' });
    }

    const orderCode = match[1].toLowerCase();

    // Lấy tất cả các đơn hàng đang chờ thanh toán
    const pendingOrders = await SaleOrder.find({ status: 'Chờ thanh toán' }).populate('customer');
    
    // Tìm đơn hàng có 8 ký tự cuối của ID khớp với orderCode
    const saleOrder = pendingOrders.find(order => order._id.toString().slice(-8).toLowerCase() === orderCode);

    if (!saleOrder) {
      return res.status(200).json({ success: false, message: `Không tìm thấy đơn hàng chờ thanh toán tương ứng với mã ${orderCode}` });
    }

    // Cập nhật trạng thái đơn hàng sang Đã thanh toán
    saleOrder.status = 'Đã thanh toán';
    await saleOrder.save();

    // Tạo Giao dịch
    await Transaction.create({
      type: 'pos_sale',
      amount: saleOrder.totalAmount,
      paymentMethod: 'Chuyển khoản QR',
      customer: saleOrder.customer ? saleOrder.customer._id : null,
      customerName: saleOrder.customer ? saleOrder.customer.name : 'Khách Lẻ',
      saleOrder: saleOrder._id,
      status: 'success'
    });

    // Truy vấn thông tin sản phẩm để tạo hóa đơn
    const invoiceItems = [];
    for (const item of saleOrder.details) {
      const product = await Product.findById(item.product);
      invoiceItems.push({
        name: product ? product.name : 'Sản phẩm',
        quantity: item.quantity,
        price: item.sellPrice,
        total: item.quantity * item.sellPrice
      });
    }

    // Tạo Hóa đơn
    const invoice = await Invoice.create({
      customer: saleOrder.customer ? saleOrder.customer._id : null,
      customerName: saleOrder.customer ? saleOrder.customer.name : 'Khách Lẻ',
      customerPhone: saleOrder.customer ? saleOrder.customer.phone : '',
      type: 'pos',
      referenceId: saleOrder._id,
      items: invoiceItems,
      subtotal: saleOrder.totalAmount,
      total: saleOrder.totalAmount,
      paymentMethod: 'Chuyển khoản QR',
      paymentStatus: 'paid'
    });

    console.log(`[Webhook] Đã đối soát thành công đơn hàng: ${saleOrder._id}, Tạo mã hóa đơn: ${invoice.code}`);

    res.status(200).json({ success: true, message: 'Đăng ký thanh toán thành công' });
  } catch (error) {
    console.error('Lỗi xử lý Webhook:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const sales = await SaleOrder.find()
      .populate('customer', 'name phone') // Sửa lỗi typo fullName -> name
      .populate('details.product', 'name category imageUrl')
      .sort({ createdAt: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách bán hàng', error: error.message });
  }
};
