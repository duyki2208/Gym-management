const mongoose = require("mongoose");

const contractTransferSchema = new mongoose.Schema(
  {
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage", required: true },
    fromCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    toCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    transferDate: { type: Date, default: Date.now, required: true },
    transferFee: { type: Number, default: 1000000, required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin thực hiện
    note: { type: String, default: "" },
    remainingSessionsAtTransfer: { type: Number, default: 0 },
    endDateAtTransfer: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

contractTransferSchema.index({ contract: 1 });
contractTransferSchema.index({ fromCustomer: 1 });
contractTransferSchema.index({ toCustomer: 1 });

module.exports = mongoose.model("ContractTransfer", contractTransferSchema);
