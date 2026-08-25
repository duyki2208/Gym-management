const mongoose = require('mongoose');
const SaleOrder = require('../models/SaleOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const { isReplicaSetConnected } = require('../utils/dbTransaction');

exports.createCheckout = async (req, res) => {
  let session = null;
  let useSession = false;

  if (isReplicaSetConnected()) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useSession = true;
    } catch (err) {
      useSession = false;
      if (session) session.endSession();
      session = null;
    }
  }

  const queryOptions = useSession ? { session } : {};

  try {
    const { customerId, details, paymentMethod, note } = req.body;
    
    let isWalkIn = true;
    let validCustomerId = null;
    let totalAmount = 0;
    let cust = null;
    
    if (customerId) {
      cust = await Customer.findById(customerId, null, queryOptions);
      if (cust) {
        isWalkIn = false;
        validCustomerId = cust._id;
      }
    }

    // Xác định trạng thái ban đầu của hóa đơn POS
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

    // Tính toán và trừ tồn kho nguyên tử (atomic decrement)
    for (const item of details) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, stockQuantity: { $gte: item.quantity } },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true, ...queryOptions }
      );

      if (!updatedProduct) {
        const existingProduct = await Product.findById(item.product, null, queryOptions);
        if (!existingProduct) {
          throw new Error(`NOT_FOUND:Không tìm thấy sản phẩm`);
        } else {
          throw new Error(`INSUFFICIENT_STOCK:Sản phẩm ${existingProduct.name} chỉ còn ${existingProduct.stockQuantity} trong kho.`);
        }
      }
      
      const itemTotal = item.quantity * updatedProduct.sellPrice;
      totalAmount += itemTotal;
      
      saleOrder.details.push({
        product: updatedProduct._id,
        quantity: item.quantity,
        sellPrice: updatedProduct.sellPrice
      });

      invoiceItems.push({
        name: updatedProduct.name,
        quantity: item.quantity,
        price: updatedProduct.sellPrice,
        total: itemTotal
      });
    }

    saleOrder.totalAmount = totalAmount;
    await saleOrder.save(queryOptions);

    // Nếu thanh toán bằng Tiền mặt, tạo luôn Hóa đơn & Giao dịch
    if (status === 'Đã thanh toán') {
      await Transaction.create([
        {
          type: 'pos_sale',
          amount: totalAmount,
          paymentMethod: 'Tiền mặt',
          customer: validCustomerId,
          customerName: cust ? cust.name : 'Khách Lẻ',
          saleOrder: saleOrder._id,
          status: 'success',
          staff: req.user ? req.user._id : null
        }
      ], queryOptions);

      await Invoice.create([
        {
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
        }
      ], queryOptions);
    }

    if (useSession && session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.status(201).json({ 
      success: true, 
      message: status === 'Đã thanh toán' ? 'Thanh toán thành công' : 'Đã tạo đơn hàng chờ thanh toán', 
      saleOrder 
    });

  } catch (error) {
    if (useSession && session) {
      await session.abortTransaction();
      session.endSession();
    }

    if (error.message && error.message.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ success: false, message: error.message.replace("NOT_FOUND:", "") });
    }
    if (error.message && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ success: false, message: error.message.replace("INSUFFICIENT_STOCK:", "") });
    }
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
    const { startDate, endDate, search, paymentMethod, preset } = req.query;
    let filter = {};

    // Lọc thời gian theo preset hoặc ngày tùy chọn
    let start, end;
    const now = new Date();
    
    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (preset === 'thisWeek') {
      const dayOfWeek = now.getDay();
      const distanceToMonday = (dayOfWeek + 6) % 7;
      start = new Date(now);
      start.setDate(now.getDate() - distanceToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (preset === '7days') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (preset === '30days') {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (startDate || endDate) {
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }
    } else if (preset === 'all') {
      // Không lọc ngày
    } else {
      // Mặc định: Hôm nay
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = start;
      if (end) filter.createdAt.$lte = end;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    let sales = await SaleOrder.find(filter)
      .populate('customer', 'name phone email')
      .populate('details.product', 'name category imageUrl sellPrice')
      .sort({ createdAt: -1 });

    // Lọc theo từ khóa tìm kiếm (Mã đơn, tên/SĐT khách hàng, tên sản phẩm)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      sales = sales.filter(s => {
        const code = `XBH${s._id.toString().slice(-8).toUpperCase()}`.toLowerCase();
        const rawId = s._id.toString().toLowerCase();
        const custName = (s.customer?.name || 'Khách lẻ').toLowerCase();
        const custPhone = (s.customer?.phone || '').toLowerCase();
        const prodMatch = s.details?.some(d => d.product?.name?.toLowerCase().includes(q));
        return code.includes(q) || rawId.includes(q) || custName.includes(q) || custPhone.includes(q) || prodMatch;
      });
    }

    // Tính toán tổng số liệu (Summary) — Chỉ tính đơn đã thanh toán hoàn tất (không công nợ)
    const paidSales = sales.filter(item => item.status === 'Đã thanh toán');
    const totalAmountSum = paidSales.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const paidAmountSum = totalAmountSum;
    const dueAmountSum = 0;

    res.status(200).json({
      success: true,
      sales,
      summary: {
        totalAmount: totalAmountSum,
        totalPaid: paidAmountSum,
        totalDue: dueAmountSum,
        totalOrders: sales.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách bán hàng', error: error.message });
  }
};

// @desc    Xác nhận thanh toán thủ công cho đơn hàng POS VietQR
// @route   PATCH /api/v1/pos/orders/:id/confirm
exports.confirmPayment = async (req, res) => {
  try {
    const saleOrder = await SaleOrder.findById(req.params.id).populate('customer');
    if (!saleOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (saleOrder.status !== 'Chờ thanh toán') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này không ở trạng thái chờ thanh toán' });
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
      status: 'success',
      staff: req.user ? req.user._id : null
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
    await Invoice.create({
      customer: saleOrder.customer ? saleOrder.customer._id : null,
      customerName: saleOrder.customer ? saleOrder.customer.name : 'Khách Lẻ',
      customerPhone: saleOrder.customer ? saleOrder.customer.phone : '',
      type: 'pos',
      referenceId: saleOrder._id,
      items: invoiceItems,
      subtotal: saleOrder.totalAmount,
      total: saleOrder.totalAmount,
      paymentMethod: 'Chuyển khoản QR',
      paymentStatus: 'paid',
      staff: req.user ? req.user._id : null
    });

    res.status(200).json({ success: true, message: 'Đã xác nhận thanh toán đơn hàng thành công', saleOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xác nhận thanh toán', error: error.message });
  }
};

// @desc    Hủy đơn hàng chờ thanh toán và hoàn trả tồn kho
// @route   PATCH /api/v1/pos/orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const saleOrder = await SaleOrder.findById(req.params.id);
    if (!saleOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (saleOrder.status !== 'Chờ thanh toán') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn hàng đang ở trạng thái chờ thanh toán' });
    }

    // Cập nhật trạng thái đơn hàng sang Đã huỷ
    saleOrder.status = 'Đã huỷ';
    await saleOrder.save();

    // Hoàn trả tồn kho cho từng sản phẩm trong đơn hàng
    for (const item of saleOrder.details) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stockQuantity += item.quantity;
        await product.save();
      }
    }

    res.status(200).json({ success: true, message: 'Đã hủy đơn hàng và hoàn trả tồn kho thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hủy đơn hàng', error: error.message });
  }
};

