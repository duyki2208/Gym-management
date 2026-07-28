const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    // === Thông tin phòng tập ===
    gymName: { type: String, default: "Gym Admin Fitness" },
    address: { type: String, default: "123 Đường ABC, Quận 1" },
    targetRevenue: { type: Number, default: 100000000 },

    // === Hoa hồng PT ===
    ptSessionPrice: { type: Number, default: 500000 },    // Giá mặc định 1 buổi PT (VNĐ)
    ptCommissionRate: { type: Number, default: 10 },       // % hoa hồng PT mặc định

    // === Hoa hồng Sale ===
    saleNewContractRate: { type: Number, default: 5 },     // % hoa hồng hợp đồng mới
    saleRenewRate: { type: Number, default: 3 },           // % hoa hồng gia hạn
    saleUpsellRate: { type: Number, default: 4 },          // % hoa hồng upsell nâng gói

    // === KPI mặc định ===
    ptMonthlySessionTarget: { type: Number, default: 80 },           // Target buổi PT/tháng
    saleMonthlyRevenueTarget: { type: Number, default: 100000000 },  // Target doanh thu Sale/tháng
    saleMonthlyContractTarget: { type: Number, default: 20 },        // Target số HĐ mới/tháng
    saleMonthlyRenewTarget: { type: Number, default: 15 },           // Target gia hạn/tháng

    // === Vận hành ===
    gymCapacity: { type: Number, default: 50 },            // Sức chứa tối đa phòng tập
    minStockAlert: { type: Number, default: 5 },           // Ngưỡng cảnh báo tồn kho thấp
    transferFee: { type: Number, default: 1000000 },       // Phí chuyển nhượng hợp đồng (VNĐ)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
