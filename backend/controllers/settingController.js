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
      gymCapacity, minStockAlert, transferFee,
      // Nhắc nhở tự động
      sendExpiryReminder, expiryReminderDays, sendInactiveReminder, inactiveDays,
      // Thanh toán
      vietqrBank, vietqrAccountNo, vietqrAccountName, posTerminalId, sepayApiKey,
      // Thiết bị nhận diện khuôn mặt
      faceAiServerUrl, faceMatchThreshold, cameraRtspUrl,
      // Mẫu nhắc nhở & Ma trận quyền
      reminderTemplates, rolePermissions,
    } = req.body;

    let setting = await Setting.findOne();
    
    if (!setting) {
      setting = new Setting();
    }

    // Cập nhật các trường số
    const numericFields = {
      targetRevenue, ptSessionPrice, ptCommissionRate,
      saleNewContractRate, saleRenewRate, saleUpsellRate,
      ptMonthlySessionTarget,
      saleMonthlyRevenueTarget, saleMonthlyContractTarget, saleMonthlyRenewTarget,
      gymCapacity, minStockAlert, transferFee,
      expiryReminderDays, inactiveDays, faceMatchThreshold,
    };

    // Cập nhật chuỗi và boolean
    if (gymName !== undefined) setting.gymName = gymName;
    if (address !== undefined) setting.address = address;
    if (sendExpiryReminder !== undefined) setting.sendExpiryReminder = Boolean(sendExpiryReminder);
    if (sendInactiveReminder !== undefined) setting.sendInactiveReminder = Boolean(sendInactiveReminder);

    if (vietqrBank !== undefined) setting.vietqrBank = vietqrBank;
    if (vietqrAccountNo !== undefined) setting.vietqrAccountNo = vietqrAccountNo;
    if (vietqrAccountName !== undefined) setting.vietqrAccountName = vietqrAccountName;
    if (posTerminalId !== undefined) setting.posTerminalId = posTerminalId;
    if (sepayApiKey !== undefined) setting.sepayApiKey = sepayApiKey;

    if (faceAiServerUrl !== undefined) setting.faceAiServerUrl = faceAiServerUrl;
    if (cameraRtspUrl !== undefined) setting.cameraRtspUrl = cameraRtspUrl;

    if (reminderTemplates !== undefined) setting.reminderTemplates = reminderTemplates;
    if (rolePermissions !== undefined) setting.rolePermissions = rolePermissions;

    // Cập nhật các trường số
    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null && value !== "") {
        setting[key] = Number(value);
      }
    }
    
    await setting.save();

    // Đồng bộ tên phòng tập & địa chỉ sang CSDL Trung tâm (Branch)
    if (gymName !== undefined || address !== undefined) {
      try {
        const { getCentralModels } = require("../db/branchConnectionManager");
        const centralModels = await getCentralModels();
        const targetBranchCode = req.branchCode || req.user?.activeBranch || req.user?.branchCode;
        if (targetBranchCode && centralModels?.Branch) {
          const updateBranch = {};
          if (gymName !== undefined) updateBranch.name = gymName;
          if (address !== undefined) updateBranch.address = address;
          await centralModels.Branch.findOneAndUpdate(
            { code: targetBranchCode.toUpperCase() },
            { $set: updateBranch }
          );
        }
      } catch (syncErr) {
        console.warn("[updateSettings] Không thể đồng bộ sang Central Branch:", syncErr.message);
      }
    }
    
    const cacheService = require("../utils/cacheService");
    await cacheService.delPattern("api:settings");
    await cacheService.delPattern("api:branches");
    await cacheService.delPattern("api:auth*");

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
