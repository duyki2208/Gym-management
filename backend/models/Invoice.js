const mongoose = require("mongoose");
const Counter = require("./Counter");

const invoiceSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Khách Lẻ" },
    customerPhone: { type: String, default: "" },
    type: { type: String, enum: ["package", "pos"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID của SaleOrder hoặc CustomerPackage
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, required: true }, // e.g. "Tiền mặt", "Chuyển khoản QR"
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "deposit"],
      default: "paid",
    },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Tự động sinh mã hóa đơn dạng INV00001
invoiceSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "invoiceId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.code = "INV" + counter.seq.toString().padStart(5, "0");
    } catch (error) {
      throw error;
    }
  }
});

module.exports = mongoose.model("Invoice", invoiceSchema);
