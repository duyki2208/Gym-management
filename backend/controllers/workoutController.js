const WorkoutSession = require("../models/WorkoutSession");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const User = require("../models/User");
const Commission = require("../models/Commission");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const syncCustomerFields = require("../utils/syncCustomer");
const { sendZaloNotification } = require("../utils/zaloService");
const queueService = require("../utils/queueService");

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
    const workouts = await WorkoutSession.find({ customer: customerId })
      .populate("confirmedBy", "fullName username role")
      .populate("pt", "fullName username role")
      .sort({ date: -1 });
    res.json(workouts);
  } catch (error) {
    console.error("Lỗi lấy lịch sử tập:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};

// Deduct a session function
exports.deductSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { ptId, ptName, note, payPerSession, paymentMethod } = req.body;



    // Ưu tiên ptId (ObjectId). Nếu không có thì dùng ptName (backward compat)
    let resolvedPtId = ptId || null;
    let resolvedPtName = ptName || "";

    if (ptId) {
      // Lookup PT user để lấy tên hiển thị
      const ptUser = await User.findById(ptId).select("fullName username role");
      if (!ptUser) {
        return res.status(400).json({ message: "Không tìm thấy PT với ID này" });
      }
      if (ptUser.role !== "pt") {
        return res.status(400).json({ message: "Nhân viên được chọn không phải PT" });
      }
      resolvedPtName = ptUser.fullName || ptUser.username;
    } else if (!ptName) {
      return res.status(400).json({ message: "Vui lòng chọn Huấn luyện viên (PT)" });
    }

    let customer = await Customer.findById(id);
    if (!customer) {
      const pkg = await CustomerPackage.findById(id);
      if (pkg) {
        customer = await Customer.findById(pkg.customer);
      }
    }
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    const setting = await Setting.findOne();
    const sessionPrice = setting?.ptSessionPrice || 500000;
    const isPayPerSession = payPerSession === true;

    // Check if customer has remaining sessions if not payPerSession
    if (!isPayPerSession && customer.remainingSessions <= 0) {
      return res.status(400).json({ message: "Khách hàng đã hết số buổi tập trong hệ thống" });
    }

    // Create session record
    const newSession = new WorkoutSession({
      customer: customer._id,
      pt: resolvedPtId,
      ptName: resolvedPtName,
      confirmedBy: req.user._id,
      note: note || "",
    });

    await newSession.save();

    // Gửi tin nhắn Zalo OA bất đồng bộ qua Queue ngầm (Non-blocking response)
    if (customer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: customer.phone,
        message: `Kính chào ${customer.name}, buổi tập của quý khách với PT ${resolvedPtName} đã được ghi nhận thành công lúc ${new Date().toLocaleTimeString("vi-VN")}. Số buổi còn lại: ${isPayPerSession ? 'Thanh toán trực tiếp' : (customer.remainingSessions > 0 ? customer.remainingSessions - 1 : 0)}. Cảm ơn quý khách!`,
        type: "workout_deduction"
      });
    }

    // Tạo giao dịch nếu thanh toán trực tiếp từng buổi
    if (isPayPerSession) {
      try {
        await Transaction.create({
          type: "pt_session",
          amount: sessionPrice,
          paymentMethod: paymentMethod || "Tiền mặt",
          customer: customer._id,
          customerName: customer.name,
          workoutSession: newSession._id,
          status: "success",
          staff: req.user ? req.user._id : undefined,
        });
      } catch (txnErr) {
        console.error("Lỗi tạo giao dịch pt_session:", txnErr);
      }
    }

    // Tự động tạo bản ghi hoa hồng PT nếu có ptId
    if (resolvedPtId) {
      try {
        const commissionRate = setting?.ptCommissionRate || 10;
        const commissionAmount = sessionPrice * (commissionRate / 100);

        await Commission.create({
          type: "pt",
          staff: resolvedPtId,
          amount: commissionAmount,
          rate: commissionRate,
          baseAmount: sessionPrice,
          workoutSession: newSession._id,
          customer: customer._id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        });
      } catch (commErr) {
        console.error("Lỗi tạo bản ghi hoa hồng PT:", commErr);
        // Không block việc trừ buổi — hoa hồng có thể tính lại sau
      }
    }

    // Deduct from active package if available, else fallback to customer directly (only if NOT payPerSession)
    if (!isPayPerSession) {
      if (customer.activePackage) {
        const activePkg = await CustomerPackage.findById(customer.activePackage);
        if (activePkg) {
          activePkg.remainingSessions = Math.max(0, activePkg.remainingSessions - 1);
          await activePkg.save();
          await syncCustomerFields(customer._id);
          customer.remainingSessions = activePkg.remainingSessions;
        } else {
          customer.remainingSessions = Math.max(0, customer.remainingSessions - 1);
          await customer.save();
        }
      } else {
        customer.remainingSessions = Math.max(0, customer.remainingSessions - 1);
        await customer.save();
      }
    }

    // Populate PT info trước khi trả response
    await newSession.populate("pt", "fullName username role");
    await newSession.populate("confirmedBy", "fullName username role");

    res.status(201).json({
      message: "Trừ buổi tập thành công",
      session: newSession,
      remainingSessions: customer.remainingSessions
    });
  } catch (error) {
    console.error("Lỗi khi trừ buổi tập:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};

// Delete a session (Only Admin)
exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params; // Workout session ID
    const session = await WorkoutSession.findById(id);

    if (!session) {
      return res.status(404).json({ message: "Không tìm thấy buổi tập" });
    }

    // Kiểm tra kỳ hoa hồng PT đã bị khóa (approved hoặc paid) chưa
    const CommissionPeriod = require("../models/CommissionPeriod");
    const sessionMonth = new Date(session.date).getMonth() + 1;
    const sessionYear = new Date(session.date).getFullYear();
    const lockedPeriod = await CommissionPeriod.findOne({
      month: sessionMonth,
      year: sessionYear,
      type: "pt",
      status: { $in: ["approved", "paid"] }
    });
    if (lockedPeriod) {
      return res.status(400).json({ message: "Kỳ thanh toán hoa hồng PT của buổi tập này đã được duyệt hoặc chi trả, không thể xóa." });
    }

    const customer = await Customer.findById(session.customer);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng của buổi tập này" });
    }

    // Thu hồi hoa hồng liên quan (nếu có)
    try {
      await Commission.updateMany(
        { workoutSession: id, status: "active" },
        {
          status: "revoked",
          revokedReason: "Xóa buổi tập",
          revokedAt: new Date(),
          revokedBy: req.user._id,
        }
      );
    } catch (commErr) {
      console.error("Lỗi thu hồi hoa hồng:", commErr);
    }

    // Hủy bỏ giao dịch liên quan (nếu có) để loại bỏ khỏi doanh thu
    try {
      await Transaction.updateMany(
        { workoutSession: id },
        { status: "failed" }
      );
    } catch (txnErr) {
      console.error("Lỗi hủy giao dịch pt_session:", txnErr);
    }

    // Xóa session
    await session.deleteOne();

    // Hoàn lại 1 buổi tập cho customer package nếu có
    if (customer.activePackage) {
      const activePkg = await CustomerPackage.findById(customer.activePackage);
      if (activePkg) {
        activePkg.remainingSessions += 1;
        await activePkg.save();
        await syncCustomerFields(customer._id);
        customer.remainingSessions = activePkg.remainingSessions;
      } else {
        customer.remainingSessions += 1;
        await customer.save();
      }
    } else {
      customer.remainingSessions += 1;
      await customer.save();
    }

    res.json({
      message: "Xóa buổi tập thành công và đã hoàn lại 1 buổi",
      remainingSessions: customer.remainingSessions
    });
  } catch (error) {
    console.error("Lỗi khi xóa buổi tập:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};
