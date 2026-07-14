const mongoose = require("mongoose");

const kpiTargetSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    
    // PT Targets
    ptSessionTarget: { type: Number },
    
    // Sale Targets
    saleRevenueTarget: { type: Number },
    saleNewContractTarget: { type: Number },
    saleRenewTarget: { type: Number },
    
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    note: { type: String, default: "" }
  },
  { timestamps: true }
);

// Ràng buộc duy nhất: Một nhân viên chỉ có 1 bản ghi KPI mỗi tháng
kpiTargetSchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("KPITarget", kpiTargetSchema);
