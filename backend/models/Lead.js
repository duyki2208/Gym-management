const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      enum: ["facebook", "hotline", "referral", "web", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["new", "contacted", "trial", "converted", "lost"],
      default: "new",
    },
    assignedSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: [
      {
        note: { type: String, required: true },
        date: { type: Date, default: Date.now },
        author: { type: String, default: "System" },
      },
    ],
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedSale: 1 });

module.exports = mongoose.model("Lead", leadSchema);
