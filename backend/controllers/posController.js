const mongoose = require('mongoose');
const SaleOrder = require('../models/SaleOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const posOrderService = require('../services/posOrderService');
const Setting = require('../models/Setting');
const { getBranchModels, getCentralModels } = require('../db/branchConnectionManager');
const {
  completePosPayment,
  PaymentCompletionError,
} = require('../services/posPaymentService');
const { PERMISSIONS, userHasPermission } = require('../middleware/permissions');


const getPosModels = (req) => req.models || { SaleOrder, Product, Customer, Transaction, Invoice, Setting, connection: mongoose.connection };

exports.createCheckout = async (req, res) => {
  try {
    const saleOrder = await posOrderService.createCheckout({
      models: getPosModels(req), data: req.body, actorId: req.user?._id,
      idempotencyKey: req.headers?.['idempotency-key'],
    });
    res.status(201).json({ success: true, saleOrder });
  } catch (error) {
    res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({ success: false, code: error.code, message: error.message });
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
    const canReadAll = await userHasPermission(req, PERMISSIONS.POS_READ_ALL);
    if (!canReadAll && String(saleOrder.staff || '') !== String(req.user?._id || '')) {
      return res.status(403).json({
        success: false,
        code: 'OBJECT_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập đơn hàng này',
      });
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
    const sepayTxId = String(
      body.id ||
      body.referenceCode ||
      (body.data && (body.data.id || body.data.referenceCode)) ||
      ''
    ).trim();

    if (!sepayTxId) {
      return res.status(400).json({
        success: false,
        message: 'Webhook thiếu mã giao dịch ổn định để xử lý idempotency'
      });
    }

    console.log(`[Webhook SePay] [Chi nhánh ${branchCode}] Mã GD SePay: ${sepayTxId} | Nội dung: "${content}" | Số tiền: ${amount}`);

    // New orders use the complete ID; legacy QR references still match without a date limit.
    const match = content.match(/GYM[\s\-_]*([a-f0-9]{24}|[a-f0-9]{8})(?![a-z0-9])/i);
    if (!match) return res.status(200).json({ success: false, message: 'Nội dung chuyển khoản không có mã đơn hợp lệ' });
    const orderCode = match[1].toLowerCase();
    const filter = orderCode.length === 24
      ? { paymentReference: `GYM${orderCode.toUpperCase()}` }
      : { $expr: { $eq: [{ $substrBytes: [{ $toString: '$_id' }, 16, 8] }, orderCode] } };
    const central = req.centralModels || await getCentralModels();
    const branches = await central.Branch.find({ isActive: { $ne: false } }).select('code').lean();
    const codes = [...new Set([branchCode, ...branches.map(branch => branch.code)])];
    const matches = [];
    for (const code of codes) {
      const branchModels = code === branchCode ? getPosModels(req) : await getBranchModels(code);
      const orders = await branchModels.SaleOrder.find(filter).limit(2);
      orders.forEach(order => matches.push({ order, models: branchModels }));
    }
    if (matches.length > 1) return res.status(409).json({ success: false, code: 'AMBIGUOUS_PAYMENT_REFERENCE', message: 'Mã thanh toán trùng, cần đối soát thủ công.' });
    const matchedOrder = matches[0]?.order;
    const activeModels = matches[0]?.models;

    if (!matchedOrder) {
      console.warn(`[Webhook SePay] Không tìm thấy đơn hàng nào có 8 ký tự cuối là GYM${orderCode.toUpperCase()}`);
      return res.status(200).json({
        success: false,
        message: `Không tìm thấy đơn hàng tương ứng với mã GYM${orderCode.toUpperCase()}`
      });
    }

    // Không thoát sớm khi order đã paid: service sẽ kiểm tra và repair
    // Transaction/Invoice còn thiếu từ một lần xử lý bị gián đoạn.
    const paymentResult = await completePosPayment({
      models: activeModels,
      orderId: matchedOrder._id,
      amount,
      paymentMethod: 'Chuyển khoản QR',
      paymentProvider: 'sepay',
      providerTransactionId: sepayTxId,
    });

    console.log(`[Webhook SePay] [Chi nhánh ${branchCode}] Đối soát thành công đơn hàng ${matchedOrder._id}, hóa đơn ${paymentResult.invoice.code}`);

    return res.status(200).json({
      success: true,
      message: paymentResult.repaired
        ? 'Đã khôi phục đầy đủ dữ liệu thanh toán còn thiếu'
        : paymentResult.duplicate
          ? 'Giao dịch đã được xử lý trước đó'
          : 'Thanh toán thành công và đã tạo hóa đơn',
      orderId: matchedOrder._id,
      invoiceCode: paymentResult.invoice.code,
      idempotent: paymentResult.duplicate,
      repaired: paymentResult.repaired,
      atomic: paymentResult.usedTransaction,
    });
  } catch (error) {
    console.error('[Webhook SePay Error] Lỗi xử lý Webhook:', error);
    if (error instanceof PaymentCompletionError) {
      const providerStatus = [
        'ORDER_CANCELLED',
        'PAYMENT_AMOUNT_MISMATCH',
      ].includes(error.code)
        ? 200
        : error.statusCode;
      return res.status(providerStatus).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
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
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    let filter = {};
    if (!(await userHasPermission(req, PERMISSIONS.POS_READ_ALL))) {
      filter.staff = req.user._id;
    }

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

    const populateSales = (query) => query
      .populate('customer', 'name phone email')
      .populate('details.product', 'name category imageUrl sellPrice');

    let sales;
    let totalOrders;
    let summaryRows;

    if (search && search.trim()) {
      // Search spans populated customer/product fields, so retain the existing
      // matching semantics and paginate only after those references are loaded.
      sales = await populateSales(SaleOrder.find(filter).sort({ createdAt: -1 }));

      const q = search.trim().toLowerCase();
      sales = sales.filter(s => {
        const code = `XBH${s._id.toString().slice(-8).toUpperCase()}`.toLowerCase();
        const rawId = s._id.toString().toLowerCase();
        const custName = (s.customer?.name || 'Khách lẻ').toLowerCase();
        const custPhone = (s.customer?.phone || '').toLowerCase();
        const prodMatch = s.details?.some(d => d.product?.name?.toLowerCase().includes(q));
        return code.includes(q) || rawId.includes(q) || custName.includes(q) || custPhone.includes(q) || prodMatch;
      });
      totalOrders = sales.length;
      summaryRows = sales;
      sales = sales.slice((page - 1) * limit, page * limit);
    } else {
      [sales, totalOrders, summaryRows] = await Promise.all([
        populateSales(
          SaleOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
        ),
        SaleOrder.countDocuments(filter),
        SaleOrder.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            },
          },
        ]),
      ]);
    }

    // Tính toán tổng số liệu (Summary) — Chỉ tính đơn đã thanh toán hoàn tất (không công nợ)
    const totalAmountSum = search && search.trim()
      ? summaryRows
        .filter(item => item.status === 'Đã thanh toán')
        .reduce((sum, item) => sum + (item.totalAmount || 0), 0)
      : (summaryRows.find(item => item._id === 'Đã thanh toán')?.totalAmount || 0);
    const paidAmountSum = totalAmountSum;
    const dueAmountSum = 0;

    res.status(200).json({
      success: true,
      sales,
      summary: {
        totalAmount: totalAmountSum,
        totalPaid: paidAmountSum,
        totalDue: dueAmountSum,
        totalOrders
      },
      pagination: {
        page,
        limit,
        totalItems: totalOrders,
        totalPages: Math.max(1, Math.ceil(totalOrders / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách bán hàng', error: error.message });
  }
};

// @desc    Xác nhận thanh toán thủ công cho đơn hàng POS VietQR
// @route   PATCH /api/v1/pos/orders/:id/confirm
exports.confirmPayment = async (req, res) => {
  try {
    const paymentResult = await completePosPayment({
      models: req.models || { SaleOrder, Transaction, Invoice, Product },
      orderId: req.params.id,
      paymentMethod: 'Chuyển khoản QR',
      paymentProvider: 'manual',
      staffId: req.user?._id,
    });

    res.status(200).json({
      success: true,
      message: paymentResult.repaired
        ? 'Đã khôi phục đầy đủ dữ liệu thanh toán còn thiếu'
        : paymentResult.duplicate
          ? 'Đơn hàng đã được xác nhận thanh toán trước đó'
          : 'Đã xác nhận thanh toán đơn hàng thành công',
      saleOrder: paymentResult.order,
    });
  } catch (error) {
    if (error instanceof PaymentCompletionError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    res.status(500).json({ success: false, message: 'Lỗi xác nhận thanh toán', error: error.message });
  }
};

// @desc    Hủy đơn hàng chờ thanh toán và hoàn trả tồn kho
// @route   PATCH /api/v1/pos/orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const saleOrder = await posOrderService.cancelOrder({ models: getPosModels(req), orderId: req.params.id });
    res.json({ success: true, saleOrder, message: 'Đã hủy đơn hàng và hoàn trả tồn kho thành công' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, code: error.code, message: error.message });
  }
};
