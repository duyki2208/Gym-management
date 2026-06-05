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
    const { gymName, address, targetRevenue } = req.body;
    let setting = await Setting.findOne();
    
    if (!setting) {
      setting = new Setting({
        gymName,
        address,
        targetRevenue: targetRevenue ? Number(targetRevenue) : undefined
      });
    } else {
      if (gymName !== undefined) setting.gymName = gymName;
      if (address !== undefined) setting.address = address;
      if (targetRevenue !== undefined) setting.targetRevenue = Number(targetRevenue);
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
