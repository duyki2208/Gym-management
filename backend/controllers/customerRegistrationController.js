const crypto = require("node:crypto");
const { sendRegistrationEmail } = require("../utils/emailService");
const queueService = require("../utils/queueService");
const { flattenPackage } = require("../services/customerQueryService");
const {
  CustomerRegistrationError,
  registerCustomer,
} = require("../services/customerRegistrationService");
const { createSaleCommission } = require("../services/commissionMutationService");
const { getCustomerDomainModels } = require("../utils/customerDomainModels");

const create = async (req, res) => {
  try {
    const models = getCustomerDomainModels(req);
    const idempotencyKey = req.get("Idempotency-Key") || crypto.randomUUID();
    const result = await registerCustomer({
      models,
      data: req.body,
      actorId: req.user?._id,
      idempotencyKey,
    });

    const existingCommission = result.customerPackage.assignedStaff
      ? await models.Commission.findOne({
          customerPackage: result.customerPackage._id,
          type: "sale",
        })
      : null;
    if (result.customerPackage.assignedStaff && !existingCommission) {
      await createSaleCommission({
        models,
        staffId: result.customerPackage.assignedStaff,
        customerPackageId: result.customerPackage._id,
        customerId: result.customer._id,
        packagePrice: result.customerPackage.price || 0,
        contractType: result.customerPackage.contractType || "new",
      });
    }

    if (!result.isReplay && result.customer.email) {
      let staffName = null;
      if (result.customerPackage.assignedStaff) {
        const populated = await models.CustomerPackage.findById(result.customerPackage._id)
          .populate("assignedStaff", "fullName");
        staffName = populated?.assignedStaff?.fullName || null;
      }
      await sendRegistrationEmail(
        result.customer.email,
        result.customer.name,
        result.customerPackage.packageName,
        result.customerPackage.startDate,
        result.customerPackage.endDate,
        result.customerPackage.price,
        staffName
      );
    }
    if (!result.isReplay && result.customer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: result.customer.phone,
        message: `Chúc mừng ${result.customer.name} đã đăng ký thành công gói tập ${result.customerPackage.packageName}.`,
        type: "package_purchase",
      });
    }

    const populatedPackage = await models.CustomerPackage.findById(result.customerPackage._id)
      .populate({
        path: "customer",
        populate: { path: "referredBy", select: "name code phone" },
      })
      .populate("trainer", "fullName username role");
    return res.status(result.isReplay ? 200 : 201).json({
      ...flattenPackage(populatedPackage),
      isNewCustomer: result.isNewCustomer,
      referralWarning: result.referralWarning,
      replayed: result.isReplay,
      idempotencyKey,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    return res.status(
      error instanceof CustomerRegistrationError ? error.statusCode : 500
    ).json({
      code: error.code,
      message: error.message || "Lỗi tạo khách hàng",
      ...(error.details || {}),
    });
  }
};

module.exports = { create };
