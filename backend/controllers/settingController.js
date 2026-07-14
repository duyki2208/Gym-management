const Setting = require("../models/Setting");

// @desc    Get system settings
// @route   GET /api/v1/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
      await setting.save();
    }
    res.json({
      success: true,
      data: setting,
      message: "Lấy cấu hình hệ thống thành công"
    });
  } catch (error) {
    console.error("Lỗi lấy cấu hình:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy cấu hình"
    });
  }
};

// @desc    Update system settings
// @route   PUT /api/v1/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
  try {
    const {
      // Thông tin cơ bản
      gymName, address, targetRevenue,
      // Hoa hồng PT
      ptSessionPrice, ptCommissionRate,
      // Hoa hồng Sale
      saleNewContractRate, saleRenewRate, saleUpsellRate,
      // KPI
      ptMonthlySessionTarget,
      saleMonthlyRevenueTarget, saleMonthlyContractTarget, saleMonthlyRenewTarget,
      // Vận hành
      gymCapacity, minStockAlert,
    } = req.body;

    let setting = await Setting.findOne();
    
    if (!setting) {
      setting = new Setting();
    }

    // Cập nhật các trường — chỉ cập nhật nếu có gửi lên
    const numericFields = {
      targetRevenue, ptSessionPrice, ptCommissionRate,
      saleNewContractRate, saleRenewRate, saleUpsellRate,
      ptMonthlySessionTarget,
      saleMonthlyRevenueTarget, saleMonthlyContractTarget, saleMonthlyRenewTarget,
      gymCapacity, minStockAlert,
    };

    if (gymName !== undefined) setting.gymName = gymName;
    if (address !== undefined) setting.address = address;

    // Cập nhật các trường số
    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null) {
        setting[key] = Number(value);
      }
    }
    
    await setting.save();
    
    res.json({
      success: true,
      data: setting,
      message: "Cập nhật cấu hình hệ thống thành công"
    });
  } catch (error) {
    console.error("Lỗi cập nhật cấu hình:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật cấu hình"
    });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
