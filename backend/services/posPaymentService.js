const { isReplicaSetConnected } = require("../utils/dbTransaction");

const MAX_TRANSACTION_ATTEMPTS = 3;

class PaymentCompletionError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "PaymentCompletionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const isDuplicateKeyError = (error) => error?.code === 11000;

const withSession = (query, session) => {
  if (session && query && typeof query.session === "function") {
    return query.session(session);
  }
  return query;
};

const sameId = (left, right) => String(left || "") === String(right || "");

const findOrder = async (SaleOrder, orderId, session) => {
  let query = SaleOrder.findById(orderId).populate("customer");
  query = withSession(query, session);
  return query;
};

const findTransaction = async (Transaction, filter, session) =>
  withSession(Transaction.findOne(filter), session);

const findInvoice = async (Invoice, filter, session) =>
  withSession(Invoice.findOne(filter), session);

const createDocument = async (Model, data, session) => {
  const documents = await Model.create([data], session ? { session } : {});
  return documents[0];
};

const ensureTransaction = async ({
  Transaction,
  order,
  paymentMethod,
  paymentProvider,
  providerTransactionId,
  staffId,
  session,
}) => {
  let existing = await findTransaction(Transaction, { saleOrder: order._id }, session);

  if (existing) {
    if (
      providerTransactionId &&
      existing.providerTransactionId &&
      existing.providerTransactionId !== providerTransactionId
    ) {
      throw new PaymentCompletionError(
        "ORDER_ALREADY_PAID_BY_ANOTHER_EVENT",
        "Đơn hàng đã gắn với một giao dịch thanh toán khác",
        409
      );
    }

    if (providerTransactionId && !existing.providerTransactionId) {
      existing.paymentProvider = paymentProvider;
      existing.providerTransactionId = providerTransactionId;
      await existing.save(session ? { session } : {});
    }

    return { document: existing, created: false };
  }

  if (providerTransactionId) {
    const eventTransaction = await findTransaction(
      Transaction,
      { paymentProvider, providerTransactionId },
      session
    );

    if (eventTransaction && !sameId(eventTransaction.saleOrder, order._id)) {
      throw new PaymentCompletionError(
        "PAYMENT_EVENT_REUSED",
        "Giao dịch từ nhà cung cấp đã được dùng cho đơn hàng khác",
        409
      );
    }
  }

  try {
    const transaction = await createDocument(
      Transaction,
      {
        type: "pos_sale",
        amount: order.totalAmount,
        paymentMethod,
        paymentProvider,
        ...(providerTransactionId ? { providerTransactionId } : {}),
        customer: order.customer?._id || null,
        customerName: order.customer?.name || "Khách Lẻ",
        saleOrder: order._id,
        status: "success",
        staff: staffId || undefined,
      },
      session
    );
    return { document: transaction, created: true };
  } catch (error) {
    // A duplicate inside a transaction aborts that transaction. Let the outer
    // retry start a fresh snapshot; standalone mode can safely re-read here.
    if (!isDuplicateKeyError(error) || session) throw error;

    existing = await findTransaction(Transaction, { saleOrder: order._id }, null);
    if (!existing && providerTransactionId) {
      existing = await findTransaction(
        Transaction,
        { paymentProvider, providerTransactionId },
        null
      );
    }

    if (!existing || !sameId(existing.saleOrder, order._id)) {
      throw new PaymentCompletionError(
        "PAYMENT_EVENT_REUSED",
        "Giao dịch từ nhà cung cấp đã được dùng cho đơn hàng khác",
        409
      );
    }

    return { document: existing, created: false };
  }
};

const buildInvoiceItems = async (Product, order, session) => {
  const invoiceItems = [];

  for (const item of order.details) {
    const product = await withSession(Product.findById(item.product), session);
    invoiceItems.push({
      name: product?.name || "Sản phẩm",
      quantity: item.quantity,
      price: item.sellPrice,
      total: item.quantity * item.sellPrice,
    });
  }

  return invoiceItems;
};

const ensureInvoice = async ({
  Invoice,
  Product,
  order,
  paymentMethod,
  staffId,
  session,
}) => {
  const invoiceFilter = { type: "pos", referenceId: order._id };
  let existing = await findInvoice(Invoice, invoiceFilter, session);
  if (existing) return { document: existing, created: false };

  const items = await buildInvoiceItems(Product, order, session);

  try {
    const invoice = await createDocument(
      Invoice,
      {
        customer: order.customer?._id || null,
        customerName: order.customer?.name || "Khách Lẻ",
        customerPhone: order.customer?.phone || "",
        type: "pos",
        referenceId: order._id,
        items,
        subtotal: order.totalAmount,
        total: order.totalAmount,
        paymentMethod,
        paymentStatus: "paid",
        staff: staffId || undefined,
      },
      session
    );
    return { document: invoice, created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error) || session) throw error;
    existing = await findInvoice(Invoice, invoiceFilter, null);
    if (!existing) throw error;
    return { document: existing, created: false };
  }
};

const persistPayment = async ({
  models,
  orderId,
  amount,
  paymentMethod,
  paymentProvider,
  providerTransactionId,
  staffId,
  session,
}) => {
  const { SaleOrder, Transaction, Invoice, Product } = models;
  const order = await findOrder(SaleOrder, orderId, session);

  if (!order) {
    throw new PaymentCompletionError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng", 404);
  }

  if (order.status === "Đã huỷ") {
    throw new PaymentCompletionError(
      "ORDER_CANCELLED",
      "Đơn hàng đã bị hủy trước khi nhận thanh toán",
      409
    );
  }

  if (Number.isFinite(amount) && amount < order.totalAmount) {
    throw new PaymentCompletionError(
      "PAYMENT_AMOUNT_MISMATCH",
      `Số tiền chuyển khoản (${amount}đ) không đủ cho đơn hàng (${order.totalAmount}đ)`,
      422
    );
  }

  const wasPaid = order.status === "Đã thanh toán";
  const transactionResult = await ensureTransaction({
    Transaction,
    order,
    paymentMethod,
    paymentProvider,
    providerTransactionId,
    staffId,
    session,
  });
  const invoiceResult = await ensureInvoice({
    Invoice,
    Product,
    order,
    paymentMethod,
    staffId,
    session,
  });

  // Status is deliberately written last in standalone mode. A crash before
  // this point leaves a retryable pending order instead of a false paid state.
  order.status = "Đã thanh toán";
  order.paidAt = order.paidAt || new Date();
  order.paymentProvider = paymentProvider;
  if (providerTransactionId) order.providerTransactionId = providerTransactionId;
  await order.save(session ? { session } : {});

  return {
    order,
    transaction: transactionResult.document,
    invoice: invoiceResult.document,
    duplicate: wasPaid && !transactionResult.created && !invoiceResult.created,
    repaired: wasPaid && (transactionResult.created || invoiceResult.created),
  };
};

const completePosPayment = async ({
  models,
  orderId,
  amount,
  paymentMethod = "Chuyển khoản QR",
  paymentProvider = "manual",
  providerTransactionId,
  staffId,
}) => {
  if (!models?.SaleOrder || !models?.Transaction || !models?.Invoice || !models?.Product) {
    throw new Error("Thiếu model cần thiết để hoàn tất thanh toán POS");
  }

  const normalizedProviderTransactionId = providerTransactionId
    ? String(providerTransactionId).trim()
    : undefined;
  const connection = models.connection;

  const operation = (session) =>
    persistPayment({
      models,
      orderId,
      amount,
      paymentMethod,
      paymentProvider,
      providerTransactionId: normalizedProviderTransactionId,
      staffId,
      session,
    });

  if (!connection || !isReplicaSetConnected(connection)) {
    return { ...(await operation(null)), usedTransaction: false };
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(
        async () => {
          result = await operation(session);
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
        }
      );
      return { ...result, usedTransaction: true };
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
    } finally {
      await session.endSession();
    }
  }

  throw lastError;
};

module.exports = { completePosPayment, PaymentCompletionError };
