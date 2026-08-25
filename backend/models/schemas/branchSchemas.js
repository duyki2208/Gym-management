/**
 * backend/models/schemas/branchSchemas.js
 * Pure schemas for Branch Databases (gympro_branch_<code>)
 */
const mongoose = require("mongoose");

// Helper function to resolve Counter model dynamically on the active connection
const getCounterModel = (doc) => {
  if (doc && doc.db && typeof doc.db.model === "function") {
    return doc.db.model("Counter");
  }
  if (doc && doc.constructor && doc.constructor.db && typeof doc.constructor.db.model === "function") {
    return doc.constructor.db.model("Counter");
  }
  return mongoose.models.Counter || mongoose.model("Counter");
};

// 1. User Schema (Staff cục bộ chi nhánh)
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
    },
    role: {
      type: String,
      enum: ["admin", "accountant", "sm", "pm", "om", "pt", "sale", "reception", "manager"],
      default: "reception",
    },
    dob: { type: Date },
    phone: { type: String },
    specialty: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// userSchema: username already has unique: true
userSchema.index({ role: 1 });

// 2. Counter Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// 3. Customer Schema
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String },
    address: { type: String },
    avatar: { type: String, default: "👤" },
    avatarUrl: { type: String, default: "" },

    packageType: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    activePackage: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage" },

    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hasLocker: { type: Boolean, default: false },
    hasWater: { type: Boolean, default: false },
    healthNote: { type: String, default: "" },
    packageNote: { type: String, default: "" },
    email: { type: String, default: "" },
    price: { type: Number, default: 0 },
    remainingSessions: { type: Number, default: 0 },
    contractCode: { type: String, default: "" },
    identityCard: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },

    paymentStatus: { type: String, enum: ["paid", "deposit", "unpaid"], default: "paid" },
    paidAmount: { type: Number, default: 0 },
    contractType: { type: String, enum: ["new", "renew", "upgrade", "transfer"], default: "new" },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    source: { type: String, default: "other" },

    faceEmbedding: { type: [Number], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const customerQueryMethods = ["find", "findOne", "findOneAndUpdate", "updateMany", "updateOne", "countDocuments"];
customerQueryMethods.forEach((method) => {
  customerSchema.pre(method, function () {
    const options = this.getOptions();
    if (options.withDeleted || options._populatePlanner) {
      return;
    }
    this.where({ isDeleted: { $ne: true } });
  });
});

customerSchema.pre("aggregate", function () {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});

customerSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const CounterModel = getCounterModel(this);
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "customerId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.code = "KH" + counter.seq.toString().padStart(4, "0");
    } catch (error) {
      throw error;
    }
  }
});

customerSchema.index({ phone: 1, isDeleted: 1 });
customerSchema.index({ code: 1, isDeleted: 1 });
customerSchema.index({ trainer: 1, isDeleted: 1 });
customerSchema.index({ assignedStaff: 1, isDeleted: 1 });
customerSchema.index({ identityCard: 1 });
customerSchema.index({ email: 1 });

// 4. CustomerPackage Schema
const customerPackageSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    packageName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true, default: 0 },
    contractCode: { type: String, required: true, default: "HĐ-CŨ" },
    packageNote: { type: String, default: "" },
    remainingSessions: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "expired", "frozen", "pending", "upgraded", "transferred"],
      default: "active",
    },
    // Multi-branch transfer status tracking
    transferStatus: {
      type: String,
      enum: ["none", "transfer_pending", "transferred_out"],
      default: "none",
    },
    branchTransferredTo: { type: String, default: null },
    branchTransferredFrom: { type: String, default: null },
    branchTransferDate: { type: Date, default: null },

    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hasLocker: { type: Boolean, default: false },
    hasWater: { type: Boolean, default: false },
    contractType: {
      type: String,
      enum: ["new", "renew", "upgrade", "transfer"],
      default: "new",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "deposit", "unpaid"],
      default: "paid",
    },
    paidAmount: { type: Number, default: 0 },
    originalCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    upgradedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage" },
    upgradeDeltaPrice: { type: Number, default: 0 },
    transferFee: { type: Number, default: 0 },
    transferredTo: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage", default: null },
    transferredFrom: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage", default: null },
    frozenPeriods: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        reason: { type: String, default: "" },
        reasonType: { type: String, enum: ["medical", "other"], default: "other" },
        freezeFee: { type: Number, default: 0 },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const packageQueryMethods = ["find", "findOne", "findOneAndUpdate", "updateMany", "updateOne", "countDocuments"];
packageQueryMethods.forEach((method) => {
  customerPackageSchema.pre(method, function () {
    const options = this.getOptions();
    if (options.withDeleted || options._populatePlanner) {
      return;
    }
    this.where({ isDeleted: { $ne: true } });
  });
});

customerPackageSchema.pre("aggregate", function () {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});

customerPackageSchema.index({ customer: 1 });
customerPackageSchema.index({ status: 1 });
customerPackageSchema.index({ transferStatus: 1 });

// 5. CheckIn Schema
const checkInSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true },
    customerCode: { type: String, required: true },
    packageType: { type: String },
    time: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

checkInSchema.index({ customerId: 1 });
checkInSchema.index({ time: -1 });

// 6. Invoice Schema
const invoiceSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Khách Lẻ" },
    customerPhone: { type: String, default: "" },
    type: { type: String, enum: ["package", "pos", "transfer", "service_fee"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
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
    paymentMethod: { type: String, required: true },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "deposit"],
      default: "paid",
    },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const CounterModel = getCounterModel(this);
      const counter = await CounterModel.findByIdAndUpdate(
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

invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ createdAt: -1 });

// 7. Transaction Schema
const transactionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    type: {
      type: String,
      enum: ["package_purchase", "pos_sale", "refund", "pt_session", "service_fee"],
      required: true,
    },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Khách Lẻ" },
    saleOrder: { type: mongoose.Schema.Types.ObjectId, ref: "SaleOrder" },
    customerPackage: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage" },
    workoutSession: { type: mongoose.Schema.Types.ObjectId, ref: "WorkoutSession" },
    status: { type: String, enum: ["success", "failed"], default: "success" },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

transactionSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const CounterModel = getCounterModel(this);
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "transactionId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.code = "TXN" + counter.seq.toString().padStart(5, "0");
    } catch (error) {
      throw error;
    }
  }
});

transactionSchema.index({ customer: 1 });
transactionSchema.index({ staff: 1 });
transactionSchema.index({ createdAt: -1, status: 1 });

// 8. SaleOrder Schema
const saleOrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    isWalkIn: { type: Boolean, default: true },
    totalAmount: { type: Number, required: true, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["Tiền mặt", "Chuyển khoản QR"],
      default: "Chuyển khoản QR",
    },
    status: {
      type: String,
      enum: ["Chờ thanh toán", "Đã thanh toán", "Đã huỷ"],
      default: "Đã thanh toán",
    },
    details: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        sellPrice: { type: Number, required: true },
      },
    ],
    note: { type: String },
  },
  { timestamps: true }
);

saleOrderSchema.index({ customer: 1 });
saleOrderSchema.index({ status: 1 });
saleOrderSchema.index({ createdAt: -1 });

// 9. Product Schema
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ["Đồ uống", "Thực phẩm bổ sung", "Dụng cụ tập", "Khác"],
      default: "Đồ uống",
    },
    importPrice: { type: Number, required: true, default: 0 },
    sellPrice: { type: Number, required: true, default: 0 },
    stockQuantity: { type: Number, required: true, default: 0 },
    imageUrl: { type: String, default: "" },
    description: { type: String },
  },
  { timestamps: true }
);

productSchema.index({ name: "text" });

// 10. ImportOrder Schema
const importOrderSchema = new mongoose.Schema(
  {
    supplier: { type: String, default: "Nhà cung cấp lẻ" },
    totalAmount: { type: Number, required: true, default: 0 },
    details: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        importPrice: { type: Number, required: true },
      },
    ],
    note: { type: String },
  },
  { timestamps: true }
);

// 11. Package Schema (Template)
const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["monthly", "session"], default: "monthly" },
    duration: { type: Number, required: true },
    sessions: { type: Number, default: 0 },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

// 12. Commission Schema
const commissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["pt", "sale"],
      required: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionPeriod",
    },
    amount: { type: Number, required: true, default: 0 },
    rate: { type: Number, required: true },
    baseAmount: { type: Number, required: true, default: 0 },
    workoutSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkoutSession",
    },
    customerPackage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerPackage",
    },
    contractType: {
      type: String,
      enum: ["new", "renew", "upgrade", "upgrade_delta", "upgrade_full_recalc", "upgrade_adjustment_minus"],
    },
    originalCommission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
    revokedReason: { type: String },
    revokedAt: { type: Date },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

commissionSchema.index({ staff: 1, month: 1, year: 1 });
commissionSchema.index({ type: 1, month: 1, year: 1 });
commissionSchema.index({ period: 1 });
commissionSchema.index({ customerPackage: 1 });
commissionSchema.index({ workoutSession: 1 });

// 13. CommissionPeriod Schema
const commissionPeriodSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    type: {
      type: String,
      enum: ["pt", "sale"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "sent_for_review", "pt_confirmed", "disputed", "pending", "approved", "paid"],
      default: "draft",
    },
    totalAmount: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    disputes: [
      {
        workoutLogId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkoutLog" },
        ptUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, required: true },
        status: { type: String, enum: ["pending", "resolved", "rejected"], default: "pending" },
        resolutionNote: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidAt: { type: Date },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

commissionPeriodSchema.index({ month: 1, year: 1, type: 1 }, { unique: true });

// 14. KPITarget Schema
const kpiTargetSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    ptSessionTarget: { type: Number },
    saleRevenueTarget: { type: Number },
    saleNewContractTarget: { type: Number },
    saleRenewTarget: { type: Number },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

kpiTargetSchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });

// 15. Lead Schema
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

// 16. Schedule Schema
const scheduleSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    shiftType: { type: String, enum: ["Sáng", "Chiều", "Hành chính", "Nghỉ"], required: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ staff: 1, date: 1 }, { unique: true });

// 17. Session Schema (Branch Users)
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// 18. Setting Schema
const settingSchema = new mongoose.Schema(
  {
    gymName: { type: String, default: "Gym Admin Fitness" },
    address: { type: String, default: "123 Đường ABC, Quận 1" },
    targetRevenue: { type: Number, default: 100000000 },
    ptSessionPrice: { type: Number, default: 500000 },
    ptCommissionRate: { type: Number, default: 10 },
    saleNewContractRate: { type: Number, default: 5 },
    saleRenewRate: { type: Number, default: 3 },
    saleUpsellRate: { type: Number, default: 4 },
    ptMonthlySessionTarget: { type: Number, default: 80 },
    saleMonthlyRevenueTarget: { type: Number, default: 100000000 },
    saleMonthlyContractTarget: { type: Number, default: 20 },
    saleMonthlyRenewTarget: { type: Number, default: 15 },
    gymCapacity: { type: Number, default: 50 },
    minStockAlert: { type: Number, default: 5 },
    transferFee: { type: Number, default: 1000000 },
  },
  { timestamps: true }
);

// 19. TeamTask Schema
const teamTaskSchema = new mongoose.Schema(
  {
    timeSlot: { type: String, required: true },
    task: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    date: { type: String, required: true },
    team: { type: String, enum: ["sale", "pt", "reception"], default: "reception" },
  },
  { timestamps: true }
);

teamTaskSchema.index({ date: 1 });

// 20. WorkoutSession Schema
const workoutSessionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    pt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    ptName: {
      type: String,
      required: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
    note: {
      type: String,
    },
  },
  { timestamps: true }
);

workoutSessionSchema.index({ customer: 1 });
workoutSessionSchema.index({ date: -1 });
workoutSessionSchema.index({ pt: 1, date: -1 });

// 21. ContractTransfer Schema
const contractTransferSchema = new mongoose.Schema(
  {
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPackage", required: true },
    fromCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    toCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    transferDate: { type: Date, default: Date.now, required: true },
    transferFee: { type: Number, default: 1000000, required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

// 22. AuditLog Schema
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: { type: String, default: "Hệ thống" },
    action: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ user: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = {
  userSchema,
  counterSchema,
  customerSchema,
  customerPackageSchema,
  checkInSchema,
  invoiceSchema,
  transactionSchema,
  saleOrderSchema,
  productSchema,
  importOrderSchema,
  packageSchema,
  commissionSchema,
  commissionPeriodSchema,
  kpiTargetSchema,
  leadSchema,
  scheduleSchema,
  sessionSchema,
  settingSchema,
  teamTaskSchema,
  workoutSessionSchema,
  contractTransferSchema,
  auditLogSchema,
};
