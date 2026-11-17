const { PaymentCompletionError } = require("./posPaymentService");

const BANK_CODES = {
  mbbank: "MB", mb: "MB", vietcombank: "VCB", vcb: "VCB",
  techcombank: "TCB", tcb: "TCB", vietinbank: "ICB", icb: "ICB",
  bidv: "BIDV", acb: "ACB", vpbank: "VPB", vpb: "VPB", tpbank: "TPB", tpb: "TPB",
};
const bankCode = (value) => typeof value === "string" ? BANK_CODES[value.trim().toLowerCase()] : undefined;
const reject = (code, message) => { throw new PaymentCompletionError(code, message, 422); };

// Accept only the documented SePay bank transaction payload, not gateway lookalikes.
const parseSepayEvent = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Number.isSafeInteger(body.id) || body.id <= 0 ||
      typeof body.content !== "string" || body.content.length > 2000 ||
      typeof body.accountNumber !== "string" || !/^[0-9A-Za-z]{4,40}$/.test(body.accountNumber) ||
      !bankCode(body.gateway)) {
    reject("INVALID_PAYMENT_EVENT", "Webhook SePay thiếu thông tin giao dịch hợp lệ");
  }
  if (body.transferType !== "in") reject("PAYMENT_NOT_INCOMING", "Chỉ tiếp nhận giao dịch tiền vào");
  if (!Number.isSafeInteger(body.transferAmount) || body.transferAmount <= 0) {
    reject("INVALID_PAYMENT_AMOUNT", "Số tiền webhook phải là số nguyên VNĐ dương hợp lệ");
  }
  return { id: String(body.id), content: body.content, amount: body.transferAmount,
    accountNo: body.accountNumber, bank: bankCode(body.gateway) };
};

const assertSepayOrder = (event, order) => {
  const expected = order.paymentAccount;
  if (order.paymentMethod !== "Chuyển khoản QR" || !expected?.accountNo || !expected?.bank) {
    reject("PAYMENT_ACCOUNT_UNVERIFIABLE", "Đơn thiếu tài khoản nhận tiền đã lưu, cần đối soát thủ công");
  }
  if (event.accountNo !== expected.accountNo || event.bank !== bankCode(expected.bank)) {
    reject("PAYMENT_ACCOUNT_MISMATCH", "Tài khoản hoặc ngân hàng nhận tiền không khớp đơn hàng");
  }
};

module.exports = { parseSepayEvent, assertSepayOrder };
