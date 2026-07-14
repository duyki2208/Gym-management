const mongoose = require("mongoose");
const Counter = require("./Counter");

const transactionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    type: {
      type: String,
      enum: ["package_purchase", "pos_sale", "refund", "pt_session"],
      required: true,
    },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true }, // e.g. "Tiền mặt", "Chuyển khoản QR"
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Khách Lẻ" },
    saleOrder: { type: mongoose.Schema.Types.ObjectId, ref: "SaleOrder" },
    customerPackage: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage" },
    status: { type: String, enum: ["success", "failed"], default: "success" },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Tự động sinh mã giao dịch dạng TXN00001
transactionSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "transactionId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.code = "TXN" + counter.seq.toString().padStart(5, "0");
    } catch (error) {
      throw error;
    }
  }
});

transactionSchema.index({ customer: 1 });
transactionSchema.index({ createdAt: 1, status: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
