const mongoose = require('mongoose');
const SaleOrder = require('../models/SaleOrder');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const { isReplicaSetConnected } = require('../utils/dbTransaction');
const { getBranchModels, getCentralModels } = require('../db/branchConnectionManager');
const {
  completePosPayment,
  PaymentCompletionError,
} = require('../services/posPaymentService');
const { PERMISSIONS, userHasPermission } = require('../middleware/permissions');


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
      note,
      staff: req.user?._id,
    });

    const invoiceItems = [];

    // Tính toán và trừ tồn kho nguyên tử (atomic decrement)
    for (const item of details) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, stockQuantity: { $gte: item.quantity } },
        { $inc: { stockQuantity: -item.quantity } },
        { returnDocument: "after", ...queryOptions }
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

    const candidateOrders = await targetSaleOrderModel.find({}).sort({ createdAt: -1 }).limit(100).populate('customer');
    let matchedOrder = candidateOrders.find(
      order => order._id.toString().slice(-8).toLowerCase() === orderCode
    );

    // 2. Nếu không tìm thấy, lấy danh sách chi nhánh từ Central DB thay vì hard-code.
    if (!matchedOrder) {
      let branchesToTry = [];
      try {
        const centralModels = req.centralModels || await getCentralModels();
        const branchDocuments = await centralModels.Branch.find({
          isActive: { $ne: false }
        }).select('code').lean();
        branchesToTry = branchDocuments.map((branch) => branch.code).filter(Boolean);
      } catch (branchListError) {
        console.warn(`[Webhook SePay] Không thể lấy danh sách chi nhánh: ${branchListError.message}`);
      }

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
