const WorkoutSession = require("../models/WorkoutSession");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const User = require("../models/User");
const Commission = require("../models/Commission");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const queueService = require("../utils/queueService");
const { PERMISSIONS, userHasPermission } = require("../middleware/permissions");

// Get workout history for a specific customer
exports.getWorkoutsByCustomer = async (req, res) => {
  try {
    let customerId = req.params.id;
    const customer = await Customer.findById(customerId);
    if (!customer) {
      const pkg = await CustomerPackage.findById(customerId);
      if (pkg) {
        customerId = pkg.customer;
      }
    }
    const workoutFilter = { customer: customerId };
    if (req.user?.role === "pt" && !(await userHasPermission(req, PERMISSIONS.WORKOUT_READ_ALL))) {
      workoutFilter.pt = req.user._id;
    }
    const workouts = await WorkoutSession.find(workoutFilter)
      .populate("confirmedBy", "fullName username role")
      .populate("pt", "fullName username role")
      .sort({ date: -1 });
    res.json(workouts);
  } catch (error) {
    console.error("Lỗi lấy lịch sử tập:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};

const mutations = require("../services/workoutMutationService");
const mongoose = require("mongoose");
const CommissionPeriod = require("../models/CommissionPeriod");
const modelsFor = req => req.models || { WorkoutSession, Customer, CustomerPackage, User, Commission, Setting, Transaction, CommissionPeriod, connection: mongoose.connection };

exports.deductSession = async (req, res) => {
  try {
    const operationKey = req.headers?.["idempotency-key"];
    if (operationKey && (typeof operationKey !== "string" || operationKey.length > 200)) {
      return res.status(400).json({ message: "Idempotency-Key không hợp lệ" });
    }
    const result = await mutations.deductSession({ models: modelsFor(req), id: req.params.id, data: req.body, actorId: req.user._id, operationKey });
    if (!result.duplicate && result.customer.phone) queueService.enqueue("ZALO_NOTIFICATION", {
      phone: result.customer.phone, type: "workout_deduction",
      message: `Kính chào ${result.customer.name}, buổi tập đã được ghi nhận. Số buổi còn lại: ${result.customer.remainingSessions}.`,
    });
    res.status(201).json({ message: "Trừ buổi tập thành công", session: result.workout, remainingSessions: result.customer.remainingSessions });
  } catch (error) {
    res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({ code: error.code, message: error.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const result = await mutations.deleteSession({ models: modelsFor(req), id: req.params.id, actorId: req.user._id });
    res.json({ message: result.refunded ? "Xóa buổi tập thành công và đã hoàn lại 1 buổi" : "Đã xóa buổi tập thanh toán trực tiếp", remainingSessions: result.customer.remainingSessions });
  } catch (error) {
    res.status(error.statusCode || 500).json({ code: error.code, message: error.message });
  }
};
