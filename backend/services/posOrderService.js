const mongoose = require("mongoose");
const { runWithRequiredTransaction } = require("../utils/dbTransaction");

const fail = (message, statusCode = 400, code = "INVALID_CHECKOUT") =>
  Object.assign(new Error(message), { statusCode, code });

// The names are the values exposed by the existing Settings form.
const BANK_CODES = { MBBank: "MB", Vietcombank: "VCB", Techcombank: "TCB", VietinBank: "ICB", BIDV: "BIDV", ACB: "ACB", VPBank: "VPB", TPBank: "TPB" };

const validateCheckout = ({ customerId, details, paymentMethod }) => {
  if (!["Tiền mặt", "Chuyển khoản QR"].includes(paymentMethod) ||
      !Array.isArray(details) || !details.length || details.length > 100 ||
      details.some(item => !item || !mongoose.isObjectIdOrHexString(item.product) ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) ||
      (customerId && !mongoose.isObjectIdOrHexString(customerId))) {
    throw fail("Giỏ hàng, số lượng hoặc phương thức thanh toán không hợp lệ.");
  }
};

const createCheckout = async ({ models, data, actorId, idempotencyKey }) => {
  validateCheckout(data);
  const operationKey = idempotencyKey ? String(idempotencyKey).trim() : undefined;
  if (operationKey && operationKey.length > 200) throw fail("Idempotency-Key không hợp lệ.");
  const { SaleOrder, Product, Customer, Setting, Invoice, Transaction } = models;
  return runWithRequiredTransaction(models.connection, async session => {
    if (operationKey) {
      const previous = await SaleOrder.findOne({ operationKey }).session(session);
      if (previous) {
        if (String(previous.staff) !== String(actorId)) throw fail("Mã thao tác đã được sử dụng.", 409);
        return previous;
      }
    }
    const customer = data.customerId ? await Customer.findById(data.customerId).session(session) : null;
    if (data.customerId && !customer) throw fail("Không tìm thấy hội viên đã chọn.", 404, "CUSTOMER_NOT_FOUND");
    let paymentAccount;
    if (data.paymentMethod === "Chuyển khoản QR") {
      const setting = await Setting.findOne().session(session).lean();
      const bank = BANK_CODES[setting?.vietqrBank];
      const accountNo = setting?.vietqrAccountNo?.trim();
      if (!bank || !/^[0-9A-Za-z]{4,40}$/.test(accountNo || "")) {
        throw fail("Chi nhánh chưa cấu hình tài khoản VietQR hợp lệ.", 409, "PAYMENT_ACCOUNT_NOT_CONFIGURED");
      }
      paymentAccount = { bank, accountNo, accountName: setting.vietqrAccountName || "" };
    }
    const order = new SaleOrder({
      customer: customer?._id || null, isWalkIn: !customer,
      paymentMethod: data.paymentMethod, status: data.paymentMethod === "Tiền mặt" ? "Đã thanh toán" : "Chờ thanh toán",
      staff: actorId, note: data.note, operationKey, paymentAccount, details: [],
    });
    order.paymentReference = `GYM${order._id.toString().toUpperCase()}`;
    const invoiceItems = [];
    for (const item of data.details) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, stockQuantity: { $gte: item.quantity }, sellPrice: { $gte: 0 } },
        { $inc: { stockQuantity: -item.quantity } }, { session, returnDocument: "after" }
      );
      if (!product) throw fail("Sản phẩm không tồn tại, giá không hợp lệ hoặc không đủ tồn kho.", 409, "INSUFFICIENT_STOCK");
      order.details.push({ product: product._id, quantity: item.quantity, sellPrice: product.sellPrice });
      invoiceItems.push({ name: product.name, quantity: item.quantity, price: product.sellPrice, total: item.quantity * product.sellPrice });
    }
    order.totalAmount = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    if (!Number.isFinite(order.totalAmount) || order.totalAmount < 0) throw fail("Tổng tiền không hợp lệ.");
    await order.save({ session });
    if (order.status === "Đã thanh toán") {
      await Transaction.create([{ type: "pos_sale", amount: order.totalAmount, paymentMethod: data.paymentMethod,
        customer: customer?._id || null, customerName: customer?.name || "Khách Lẻ", saleOrder: order._id,
        status: "success", staff: actorId }], { session });
      await Invoice.create([{ type: "pos", referenceId: order._id, customer: customer?._id || null,
        customerName: customer?.name || "Khách Lẻ", customerPhone: customer?.phone || "", items: invoiceItems,
        subtotal: order.totalAmount, total: order.totalAmount, paymentMethod: data.paymentMethod,
        paymentStatus: "paid", staff: actorId }], { session });
    }
    return order;
  });
};

const cancelOrder = async ({ models, orderId }) => runWithRequiredTransaction(models.connection, async session => {
  const order = await models.SaleOrder.findById(orderId).session(session);
  if (!order) throw fail("Không tìm thấy đơn hàng.", 404, "ORDER_NOT_FOUND");
  if (order.status === "Đã huỷ") return order;
  if (order.status !== "Chờ thanh toán") throw fail("Chỉ hủy được đơn đang chờ thanh toán.", 409, "ORDER_NOT_PENDING");
  const claimed = await models.SaleOrder.updateOne({ _id: order._id, status: "Chờ thanh toán" }, { $set: { status: "Đã huỷ" } }, { session });
  if (claimed.modifiedCount !== 1) throw fail("Trạng thái đơn đã thay đổi.", 409, "ORDER_NOT_PENDING");
  for (const item of order.details) {
    const restored = await models.Product.updateOne({ _id: item.product }, { $inc: { stockQuantity: item.quantity } }, { session });
    if (restored.matchedCount !== 1) throw fail("Không tìm thấy sản phẩm để hoàn kho.", 409, "PRODUCT_NOT_FOUND");
  }
  order.status = "Đã huỷ";
  return order;
});

module.exports = { createCheckout, cancelOrder, validateCheckout };
