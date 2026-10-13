const mongoose = require("mongoose");
const Product = require("../models/Product");
require("../models/Customer");
require("../models/Counter");
const SaleOrder = require("../models/SaleOrder");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const { completePosPayment } = require("../services/posPaymentService");

const baseModels = () => ({
  Product,
  SaleOrder,
  Transaction,
  Invoice,
  connection: mongoose.connection,
});

const createPendingOrder = async () => {
  const product = await Product.create({
    name: "Nước khoáng",
    category: "Đồ uống",
    importPrice: 5000,
    sellPrice: 10000,
    stockQuantity: 20,
  });

  return SaleOrder.create({
    totalAmount: 20000,
    paymentMethod: "Chuyển khoản QR",
    status: "Chờ thanh toán",
    details: [{ product: product._id, quantity: 2, sellPrice: 10000 }],
  });
};

describe("POS payment completion", () => {
  beforeEach(async () => {
    await Promise.all([
      Product.syncIndexes(),
      SaleOrder.syncIndexes(),
      Transaction.syncIndexes(),
      Invoice.syncIndexes(),
    ]);
  });

  test("repairs a paid order that is missing Transaction and Invoice", async () => {
    const order = await createPendingOrder();
    order.status = "Đã thanh toán";
    await order.save();

    const result = await completePosPayment({
      models: baseModels(),
      orderId: order._id,
      amount: 20000,
      paymentProvider: "sepay",
      providerTransactionId: "sepay-repair-1",
    });

    expect(result.repaired).toBe(true);
    expect(await Transaction.countDocuments({ saleOrder: order._id })).toBe(1);
    expect(await Invoice.countDocuments({ type: "pos", referenceId: order._id })).toBe(1);
  });

  test("five concurrent deliveries create one Transaction and one Invoice", async () => {
    const order = await createPendingOrder();

    await Promise.all(
      Array.from({ length: 5 }, () =>
        completePosPayment({
          models: baseModels(),
          orderId: order._id,
          amount: 20000,
          paymentProvider: "sepay",
          providerTransactionId: "sepay-concurrent-1",
        })
      )
    );

    expect(await Transaction.countDocuments({ saleOrder: order._id })).toBe(1);
    expect(await Invoice.countDocuments({ type: "pos", referenceId: order._id })).toBe(1);
    expect((await SaleOrder.findById(order._id)).status).toBe("Đã thanh toán");
  });

  test("a failure before Invoice creation does not leave the order paid and retry repairs it", async () => {
    const order = await createPendingOrder();
    const failingInvoiceModel = {
      findOne: (...args) => Invoice.findOne(...args),
      create: jest.fn().mockRejectedValueOnce(new Error("INJECTED_INVOICE_FAILURE")),
    };

    await expect(
      completePosPayment({
        models: { ...baseModels(), Invoice: failingInvoiceModel },
        orderId: order._id,
        amount: 20000,
        paymentProvider: "sepay",
        providerTransactionId: "sepay-retry-1",
      })
    ).rejects.toThrow("INJECTED_INVOICE_FAILURE");

    expect((await SaleOrder.findById(order._id)).status).toBe("Chờ thanh toán");
    expect(await Transaction.countDocuments({ saleOrder: order._id })).toBe(1);
    expect(await Invoice.countDocuments({ type: "pos", referenceId: order._id })).toBe(0);

    await completePosPayment({
      models: baseModels(),
      orderId: order._id,
      amount: 20000,
      paymentProvider: "sepay",
      providerTransactionId: "sepay-retry-1",
    });

    expect((await SaleOrder.findById(order._id)).status).toBe("Đã thanh toán");
    expect(await Transaction.countDocuments({ saleOrder: order._id })).toBe(1);
    expect(await Invoice.countDocuments({ type: "pos", referenceId: order._id })).toBe(1);
  });

  test("the same provider transaction cannot pay two different orders", async () => {
    const firstOrder = await createPendingOrder();
    const secondOrder = await createPendingOrder();

    await completePosPayment({
      models: baseModels(),
      orderId: firstOrder._id,
      amount: 20000,
      paymentProvider: "sepay",
      providerTransactionId: "sepay-unique-event",
    });

    await expect(
      completePosPayment({
        models: baseModels(),
        orderId: secondOrder._id,
        amount: 20000,
        paymentProvider: "sepay",
        providerTransactionId: "sepay-unique-event",
      })
    ).rejects.toMatchObject({ code: "PAYMENT_EVENT_REUSED", statusCode: 409 });
  });
});
