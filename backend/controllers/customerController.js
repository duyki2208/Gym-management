const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const faceClient = require("../utils/faceServiceClient");
const mongoose = require("mongoose");
const { flattenPackage, listCustomers } = require("../services/customerQueryService");
const { findExistingCustomer } = require("../services/customerLookupService");
const {
  CustomerExportError,
  loadExportPackages,
  createCustomerWorkbook,
} = require("../services/customerExportService");
const {
  FaceEnrollmentError,
  enrollCustomerFace,
} = require("../services/faceEnrollmentService");
const {
  CustomerProfileMutationError,
  updateCustomerProfile,
  deleteCustomerPackage,
} = require("../services/customerProfileMutationService");



const getAllCustomers = async (req, res) => {
  try {
    const models = req.models || { Customer, CustomerPackage };
    res.json(await listCustomers({ ...models, filters: req.query }));
  } catch (error) {
    console.error("Lỗi lấy danh sách khách hàng:", error);
    res.status(error.code === "INVALID_DATE_FILTER" ? 400 : 500).json({ message: error.message });
  }
};

const getCustomerProfileMutationModels = (req) => ({
  ...(req.models || {}),
  connection: req.models?.connection || mongoose.connection,
  Customer: req.models?.Customer || Customer,
  CustomerPackage: req.models?.CustomerPackage || CustomerPackage,
  Transaction: req.models?.Transaction || Transaction,
  Invoice: req.models?.Invoice || Invoice,
  User: req.models?.User || require("../models/User"),
  Package: req.models?.Package || require("../models/Package"),
  Commission: req.models?.Commission || require("../models/Commission"),
  CommissionPeriod: req.models?.CommissionPeriod || require("../models/CommissionPeriod"),
});

const updateCustomerService = async (req, res) => {
  try {
    const updatedPackage = await updateCustomerProfile({
      models: getCustomerProfileMutationModels(req),
      packageId: req.params.id,
      data: req.body,
      actorId: req.user?._id,
    });
    return res.json(flattenPackage(updatedPackage));
  } catch (error) {
    console.error("Lỗi cập nhật khách hàng:", error);
    return res.status(
      error instanceof CustomerProfileMutationError ? error.statusCode : 400
    ).json({ code: error.code, message: error.message });
  }
};

const deleteCustomerService = async (req, res) => {
  try {
    const result = await deleteCustomerPackage({
      models: getCustomerProfileMutationModels(req),
      packageId: req.params.id,
      actorId: req.user?._id,
    });
    req.deletedCustomerDetails = result.deletedCustomerDetails;
    return res.json({ message: "Đã xóa gói tập thành công" });
  } catch (error) {
    console.error("Lỗi xóa khách hàng:", error);
    return res.status(
      error instanceof CustomerProfileMutationError ? error.statusCode : 500
    ).json({ code: error.code, message: error.message });
  }
};

/**
 * @desc   Đăng ký/Cập nhật khuôn mặt cho khách hàng qua InsightFace
 * @route  POST /api/v1/customers/:id/enroll-face
 * @access Private
 */
const enrollFace = async (req, res) => {
  try {
    const models = req.models || { Customer, CustomerPackage };
    const cloudinaryConfig = require("../config/cloudinary");
    const data = await enrollCustomerFace({
      ...models,
      customerId: req.params.id,
      file: req.file,
      imageBase64: req.body?.imageBase64,
      faceClient,
      cloudinary: {
        uploadBuffer: cloudinaryConfig.uploadBuffer,
        extractPublicId: cloudinaryConfig.extractPublicId,
        client: cloudinaryConfig.cloudinary,
      },
    });
    return res.json({
      success: true,
      message: "Cập nhật khuôn mặt thành công!",
      data,
    });
  } catch (error) {
    if (error instanceof FaceEnrollmentError) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        success: false,
        message: "Dịch vụ nhận diện khuôn mặt chưa khởi động. Vui lòng chạy face-service trước.",
      });
    }
    console.error("enrollFace error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * GET /api/v1/customers/check-existing?name=...&phone=...&dob=...
 * Kiểm tra khách hàng có tồn tại không (KHÔNG ghi dữ liệu).
 * Dùng để validate real-time trên form trước khi submit.
 */
const checkExistingCustomer = async (req, res) => {
  try {
    const models = req.models || { Customer };
    return res.json(await findExistingCustomer({ Customer: models.Customer, filters: req.query }));
  } catch (error) {
    console.error("checkExistingCustomer error:", error);
    res.status(500).json({ exists: false });
  }
};

const exportCustomersExcel = async (req, res) => {
  try {
    const models = req.models || { Customer, CustomerPackage };
    const now = new Date();
    const packages = await loadExportPackages({ ...models, filters: req.query, now });
    const workbook = createCustomerWorkbook({ packages, now });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="GymPro_Customers_${Date.now()}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Lỗi xuất Excel khách hàng:", error);
    res.status(error instanceof CustomerExportError ? error.statusCode : 500).json({
      message: error instanceof CustomerExportError ? error.message : "Lỗi hệ thống khi xuất Excel khách hàng",
    });
  }
};

module.exports = {
  getAll: getAllCustomers,
  delete: deleteCustomerService,
  update: updateCustomerService,
  enrollFace,
  checkExisting: checkExistingCustomer,
  exportExcel: exportCustomersExcel,
};
