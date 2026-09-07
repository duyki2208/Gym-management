const mongoose = require('mongoose');
const SaleOrder = require('../models/SaleOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const { isReplicaSetConnected } = require('../utils/dbTransaction');
const { getBranchModels } = require('../db/branchConnectionManager');


exports.createCheckout = async (req, res) => {
  let session = null;
  let useSession = false;

  const conn = req.models?.connection || mongoose.connection;
  if (isReplicaSetConnected(conn)) {
    try {
      session = await conn.startSession();
      session.startTransaction();
      useSession = true;
    } catch (err) {
      useSession = false;
      if (session) session.endSession();
      session = null;
    }
  }

  const queryOptions = useSession && session ? { session } : {};

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
          staff: req.user ? req.user._id : undefined
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
          staff: req.user ? req.user._id : undefined
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
    console.error("Lỗi createCheckout:", error);
    if (useSession && session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }

    if (error.message && error.message.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ success: false, message: error.message.replace("NOT_FOUND:", "") });
    }
    if (error.message && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ success: false, message: error.message.replace("INSUFFICIENT_STOCK:", "") });
    }
    res.status(500).json({ success: false, message: error.message || 'Lỗi thanh toán' });
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
// @desc    Webhook nhận thông báo biến động số dư chuyển khoản thực tế từ SePay / Casso / PayOS
// @route   POST /api/v1/pos/webhook
exports.handleWebhook = async (req, res) => {
  try {
    const body = req.body;
    const branchCode = req.branchCode || req.query.branchCode || 'HN01';

    // SePay truyền thông tin giao dịch ở root (content, transferAmount, referenceCode...)
    const content = body.content || body.description || (body.data && (body.data.description || body.data.content)) || '';
    const amount = Number(body.transferAmount || body.amountIn || (body.data && body.data.amount) || 0);
    const sepayTxId = body.id || body.referenceCode || (body.data && (body.data.id || body.data.referenceCode)) || '';

    console.log(`[Webhook SePay] [Chi nhánh ${branchCode}] Mã GD SePay: ${sepayTxId} | Nội dung: "${content}" | Số tiền: ${amount}`);

    // Sử dụng Regex tìm mã đơn hàng dạng GYM[OrderID_last8]
    // Ví dụ: GYM50C1DB8C hoặc GYM 50C1DB8C hoặc GYM-50C1DB8C
    const match = content.match(/GYM[\s\-_]*([A-Za-z0-9]{8})/i);
    if (!match) {
      console.warn(`[Webhook SePay] Nội dung "${content}" không khớp định dạng GYMxxxxx`);
      return res.status(200).json({
        success: false,
        message: 'Nội dung chuyển khoản không khớp định dạng GYMxxxxx'
      });
    }

    const orderCode = match[1].toLowerCase();

    // 1. Tìm đơn hàng trong chi nhánh hiện tại
    let activeModels = req.models;
    let targetSaleOrderModel = activeModels?.SaleOrder || SaleOrder;
    let targetTransactionModel = activeModels?.Transaction || Transaction;
    let targetInvoiceModel = activeModels?.Invoice || Invoice;
    let targetProductModel = activeModels?.Product || Product;

    const candidateOrders = await targetSaleOrderModel.find({}).sort({ createdAt: -1 }).limit(100).populate('customer');
    let matchedOrder = candidateOrders.find(
      order => order._id.toString().slice(-8).toLowerCase() === orderCode
    );

    // 2. Nếu không tìm thấy, quét tìm đơn hàng qua các chi nhánh khác (phòng trường hợp nhân viên đổi chi nhánh trên POS)
    if (!matchedOrder) {
      const branchesToTry = ['HN01', 'HCM01', 'DN01'];
      for (const bCode of branchesToTry) {
        if (bCode === branchCode) continue;
        try {
          const bModels = await getBranchModels(bCode);
          if (bModels?.SaleOrder) {
            const bOrders = await bModels.SaleOrder.find({}).sort({ createdAt: -1 }).limit(100).populate('customer');
            const found = bOrders.find(
              order => order._id.toString().slice(-8).toLowerCase() === orderCode
            );
            if (found) {
              matchedOrder = found;
              activeModels = bModels;
              targetSaleOrderModel = bModels.SaleOrder;
              targetTransactionModel = bModels.Transaction;
              targetInvoiceModel = bModels.Invoice;
              targetProductModel = bModels.Product;
              console.log(`[Webhook SePay] Đã tìm thấy đơn hàng ${matchedOrder._id} tại chi nhánh fallback: ${bCode}`);
              break;
            }
          }
        } catch (bErr) {
          // Bỏ qua lỗi kết nối chi nhánh khác
        }
      }
    }

    if (!matchedOrder) {
      console.warn(`[Webhook SePay] Không tìm thấy đơn hàng nào có 8 ký tự cuối là GYM${orderCode.toUpperCase()}`);
      return res.status(200).json({
        success: false,
        message: `Không tìm thấy đơn hàng tương ứng với mã GYM${orderCode.toUpperCase()}`
      });
    }

    // 1. CHỐNG XỬ LÝ TRÙNG LẶP (IDEMPOTENCY):
    // Do đặc thù Render gói Free (spin down sau 15p), webhook lần 1 có thể timeout khiến SePay gửi lại lần 2, 3...
    // Nếu đơn hàng đã hoàn tất trước đó, trả về 200 OK ngay để SePay dừng gửi lại.
    if (matchedOrder.status === 'Đã thanh toán') {
      console.log(`[Webhook SePay] Đơn hàng ${matchedOrder._id} đã được thanh toán trước đó (idempotent). Trả về 200 OK.`);
      return res.status(200).json({
        success: true,
        message: 'Đơn hàng đã được ghi nhận thanh toán trước đó'
      });
    }

    // Nếu đơn hàng đã bị hủy
    if (matchedOrder.status === 'Đã hủy') {
      console.warn(`[Webhook SePay] Đơn hàng ${matchedOrder._id} đã bị hủy trước đó.`);
      return res.status(200).json({
        success: false,
        message: 'Đơn hàng này đã bị hủy trước khi nhận thanh toán'
      });
    }

    // 2. KIỂM TRA SỐ TIỀN THANH TOÁN:
    if (amount < matchedOrder.totalAmount) {
      console.warn(`[Webhook SePay] Số tiền chuyển khoản (${amount}đ) ít hơn tổng đơn hàng (${matchedOrder.totalAmount}đ)!`);
      return res.status(200).json({
        success: false,
        message: `Số tiền chuyển khoản (${amount}đ) không đủ cho đơn hàng (${matchedOrder.totalAmount}đ)`
      });
    }

    // 3. CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG SANG 'ĐÃ THANH TOÁN'
    matchedOrder.status = 'Đã thanh toán';
    await matchedOrder.save();

    // 4. TẠO GIAO DỊCH (TRANSACTION)
    await targetTransactionModel.create({
      type: 'pos_sale',
      amount: matchedOrder.totalAmount,
      paymentMethod: 'Chuyển khoản QR',
      customer: matchedOrder.customer ? matchedOrder.customer._id : null,
      customerName: matchedOrder.customer ? matchedOrder.customer.name : 'Khách Lẻ',
      saleOrder: matchedOrder._id,
      status: 'success'
    });

    // 5. TRUY VẤN SẢN PHẨM & TẠO HÓA ĐƠN (INVOICE)
    const invoiceItems = [];
    for (const item of matchedOrder.details) {
      const product = await targetProductModel.findById(item.product);
      invoiceItems.push({
        name: product ? product.name : 'Sản phẩm',
        quantity: item.quantity,
        price: item.sellPrice,
        total: item.quantity * item.sellPrice
      });
    }

    const invoice = await targetInvoiceModel.create({
      customer: matchedOrder.customer ? matchedOrder.customer._id : null,
      customerName: matchedOrder.customer ? matchedOrder.customer.name : 'Khách Lẻ',
      customerPhone: matchedOrder.customer ? matchedOrder.customer.phone : '',
      type: 'pos',
      referenceId: matchedOrder._id,
      items: invoiceItems,
      subtotal: matchedOrder.totalAmount,
      total: matchedOrder.totalAmount,
      paymentMethod: 'Chuyển khoản QR',
      paymentStatus: 'paid'
    });

    console.log(`[Webhook SePay] [Chi nhánh ${branchCode}] Đối soát thành công đơn hàng ${matchedOrder._id}, tạo hóa đơn ${invoice.code}`);

    return res.status(200).json({
      success: true,
      message: 'Thanh toán thành công và đã tạo hóa đơn',
      orderId: matchedOrder._id,
      invoiceCode: invoice.code
    });
  } catch (error) {
    console.error('[Webhook SePay Error] Lỗi xử lý Webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xử lý webhook SePay',
      error: error.message
    });
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

