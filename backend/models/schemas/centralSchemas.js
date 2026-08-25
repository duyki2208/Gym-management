/**
 * backend/models/schemas/centralSchemas.js
 * Pure schemas for Central Database (gympro_central)
 */
const mongoose = require("mongoose");

// 1. Branch Schema
const branchSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    hotline: {
      type: String,
      default: "",
    },
    managerName: {
      type: String,
      default: "",
    },
    dbName: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

branchSchema.index({ isActive: 1 });

// 2. CentralUser Schema (Chỉ gồm admin và accountant)
const centralUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "accountant"],
      required: true,
      default: "accountant",
    },
    allowedBranches: {
      type: [String],
      default: ["*"], // '*' nghĩa là toàn quyền truy cập tất cả chi nhánh
    },
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// centralUserSchema: username already marked unique: true
// 3. LoginIndex Schema (Tra cứu nhanh username -> branchCode)
const loginIndexSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    branchCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    role: {
      type: String,
      default: "reception",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

loginIndexSchema.index({ branchCode: 1 });

// 4. Central Session Schema (Phiên đăng nhập người dùng Central)
const centralSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralUser",
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

module.exports = {
  branchSchema,
  centralUserSchema,
  loginIndexSchema,
  centralSessionSchema,
};
