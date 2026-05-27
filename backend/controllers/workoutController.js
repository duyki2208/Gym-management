const WorkoutSession = require("../models/WorkoutSession");
const Customer = require("../models/Customer");

// Get workout history for a specific customer
exports.getWorkoutsByCustomer = async (req, res) => {
  try {
    const workouts = await WorkoutSession.find({ customer: req.params.id })
      .populate("confirmedBy", "fullName username role")
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
    const { ptName, note } = req.body;

    if (!ptName) {
      return res.status(400).json({ message: "Vui lòng nhập tên PT hướng dẫn" });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Check if customer has remaining sessions (and if the package is session-based theoretically, but checking remainingSessions > 0 is enough)
    if (customer.remainingSessions <= 0) {
      return res.status(400).json({ message: "Khách hàng đã hết số buổi tập trong hệ thống" });
    }

    // Create session record
    const newSession = new WorkoutSession({
      customer: id,
      ptName: ptName,
      confirmedBy: req.user._id, // Set by protect middleware
      note: note || "",
    });

    await newSession.save();

    // Deduct from customer
    customer.remainingSessions -= 1;
    await customer.save();

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

    const customer = await Customer.findById(session.customer);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng của buổi tập này" });
    }

    // Xóa session
    await session.deleteOne();

    // Hoàn lại 1 buổi tập cho customer
    customer.remainingSessions += 1;
    await customer.save();

    res.json({
      message: "Xóa buổi tập thành công và đã hoàn lại 1 buổi",
      remainingSessions: customer.remainingSessions
    });
  } catch (error) {
    console.error("Lỗi khi xóa buổi tập:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};
