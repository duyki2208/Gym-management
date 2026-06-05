const TeamTask = require("../models/TeamTask");
const { format } = require("date-fns");

// Helper quy đổi giờ ca trực theo mốc 5h sáng làm chuẩn
const getShiftMinutes = (timeSlot) => {
  if (!timeSlot) return Infinity;
  const match = timeSlot.match(/(\d+)(?::(\d+))?/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    if (hour < 5) {
      hour += 24; // Đẩy mốc 0h-4h sáng xuống sau 23h đêm
    }
    return hour * 60 + minute;
  }
  return Infinity;
};

// Helper kiểm tra một task đã quá hạn thực hiện (trên 5 phút) hay chưa
const isTaskExpired = (task) => {
  if (task.isCompleted) return false;

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vnTime = new Date(utc + (3600000 * 7));
  
  const year = vnTime.getFullYear();
  const month = String(vnTime.getMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Nếu là ngày cũ, các việc chưa hoàn thành đều coi là quá hạn và bị khóa
  if (task.date !== todayStr) {
    return true;
  }

  // Nếu là ngày hôm nay, check xem quá 5 phút so với giờ bắt đầu ca việc chưa
  const currentHour = vnTime.getHours();
  const currentMinute = vnTime.getMinutes();
  let currentHourShift = currentHour;
  if (currentHourShift < 5) {
    currentHourShift += 24;
  }
  const currentTotalMinutes = currentHourShift * 60 + currentMinute;
  const taskTotalMinutes = getShiftMinutes(task.timeSlot);

  const diff = taskTotalMinutes - currentTotalMinutes;
  return diff < -5; // Trễ từ 6 phút trở đi (diff <= -6) sẽ bị khóa
};

// @desc    Lấy toàn bộ công việc ca trực hôm nay
// @route   GET /api/v1/team-tasks
// @access  Private
const getTodayTasks = async (req, res) => {
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const userRole = req.user.role;
    
    let query = { date: todayStr };
    
    // Lọc công việc theo đội tương ứng với role đăng nhập
    if (userRole === "sm" || userRole === "sale") {
      query.team = "sale";
    } else if (userRole === "pm" || userRole === "pt") {
      query.team = "pt";
    } else if (userRole === "om" || userRole === "reception") {
      query.team = "reception";
    } else if (userRole === "admin" || userRole === "accountant") {
      // Admin hoặc Kế toán được lấy tất cả, hoặc lọc theo query parameter ?team=...
      if (req.query.team && ["sale", "pt", "reception"].includes(req.query.team)) {
        query.team = req.query.team;
      }
    } else {
      // Mặc định an toàn
      query.team = "reception";
    }

    const tasks = await TeamTask.find(query).lean();
    tasks.sort((a, b) => getShiftMinutes(a.timeSlot) - getShiftMinutes(b.timeSlot));
    
    res.json({
      success: true,
      data: tasks,
      message: "Lấy danh sách công việc hôm nay thành công"
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách công việc:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách công việc"
    });
  }
};

// @desc    Tạo mới một công việc ca trực
// @route   POST /api/v1/team-tasks
// @access  Private (Chỉ Manager, Admin, Kế toán)
const createTask = async (req, res) => {
  try {
    const { timeSlot, task, team } = req.body;
    const userRole = req.user.role;

    // Chỉ cho phép bậc manager/admin/kế toán thêm task
    const allowedCreators = ["admin", "accountant", "sm", "pm", "om"];
    if (!allowedCreators.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ quản lý hoặc quản trị viên mới có quyền thêm công việc ca trực!"
      });
    }

    if (!timeSlot || !task) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ khung giờ và nội dung công việc"
      });
    }

    // Xác định team cho task dựa trên role của người tạo
    let taskTeam = "";
    if (userRole === "sm") {
      taskTeam = "sale";
    } else if (userRole === "pm") {
      taskTeam = "pt";
    } else if (userRole === "om") {
      taskTeam = "reception";
    } else if (userRole === "admin" || userRole === "accountant") {
      if (!team || !["sale", "pt", "reception"].includes(team)) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn đội (team) hợp lệ cho công việc này (sale, pt, reception)"
        });
      }
      taskTeam = team;
    }

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const newTask = new TeamTask({
      timeSlot,
      task,
      date: todayStr,
      isCompleted: false,
      team: taskTeam
    });

    await newTask.save();

    res.status(201).json({
      success: true,
      data: newTask,
      message: "Tạo công việc mới thành công"
    });
  } catch (error) {
    console.error("Lỗi tạo công việc:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tạo công việc"
    });
  }
};

// @desc    Cập nhật công việc ca trực (sửa nội dung hoặc trạng thái hoàn thành)
// @route   PUT /api/v1/team-tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { timeSlot, task, isCompleted } = req.body;
    const userRole = req.user.role;

    const currentTask = await TeamTask.findById(id);
    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công việc"
      });
    }

    // Phân quyền cập nhật task
    let hasPermission = false;
    let isStaffOnlyUpdate = false; // Đánh dấu nếu là nhân viên bình thường cập nhật trạng thái hoàn thành

    if (userRole === "admin" || userRole === "accountant") {
      hasPermission = true;
    } else if (userRole === "sm" && currentTask.team === "sale") {
      hasPermission = true;
    } else if (userRole === "pm" && currentTask.team === "pt") {
      hasPermission = true;
    } else if (userRole === "om" && currentTask.team === "reception") {
      hasPermission = true;
    } else if (userRole === "sale" && currentTask.team === "sale") {
      hasPermission = true;
      isStaffOnlyUpdate = true;
    } else if (userRole === "pt" && currentTask.team === "pt") {
      hasPermission = true;
      isStaffOnlyUpdate = true;
    } else if (userRole === "reception" && currentTask.team === "reception") {
      hasPermission = true;
      isStaffOnlyUpdate = true;
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền cập nhật công việc này!"
      });
    }

    // Nếu là nhân viên thường, chặn việc chỉnh sửa nội dung/khung giờ
    if (isStaffOnlyUpdate) {
      if (timeSlot !== undefined || task !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Chỉ quản lý hoặc quản trị viên mới được chỉnh sửa nội dung công việc!"
        });
      }
    }

    // Nếu công việc đã được tích hoàn thành trước đó, chặn mọi cập nhật
    if (currentTask.isCompleted) {
      return res.status(400).json({
        success: false,
        message: "Công việc đã hoàn thành, không thể sửa đổi nội dung hoặc trạng thái"
      });
    }

    // Nếu công việc đã quá hạn thực hiện (trên 5 phút), chặn cập nhật và khóa lại
    if (isTaskExpired(currentTask)) {
      return res.status(400).json({
        success: false,
        message: "Công việc đã quá thời gian cho phép thực hiện (5 phút) và đã bị khóa."
      });
    }

    if (timeSlot !== undefined) currentTask.timeSlot = timeSlot;
    if (task !== undefined) currentTask.task = task;
    if (isCompleted !== undefined) currentTask.isCompleted = isCompleted;

    await currentTask.save();

    res.json({
      success: true,
      data: currentTask,
      message: "Cập nhật công việc thành công"
    });
  } catch (error) {
    console.error("Lỗi cập nhật công việc:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật công việc"
    });
  }
};

// @desc    Xóa công việc ca trực
// @route   DELETE /api/v1/team-tasks/:id
// @access  Private (Chỉ Manager, Admin, Kế toán của đội tương ứng)
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    const task = await TeamTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công việc"
      });
    }

    // Phân quyền xóa task
    let hasPermission = false;
    if (userRole === "admin" || userRole === "accountant") {
      hasPermission = true;
    } else if (userRole === "sm" && task.team === "sale") {
      hasPermission = true;
    } else if (userRole === "pm" && task.team === "pt") {
      hasPermission = true;
    } else if (userRole === "om" && task.team === "reception") {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa công việc này!"
      });
    }

    // Nếu công việc đã được tích hoàn thành, chặn việc xóa
    if (task.isCompleted) {
      return res.status(400).json({
        success: false,
        message: "Công việc đã hoàn thành, không thể xóa"
      });
    }

    // Nếu công việc đã quá hạn thực hiện (trên 5 phút), chặn việc xóa và khóa lại
    if (isTaskExpired(task)) {
      return res.status(400).json({
        success: false,
        message: "Công việc đã quá thời gian cho phép thực hiện (5 phút) và đã bị khóa."
      });
    }

    await task.deleteOne();

    res.json({
      success: true,
      data: {},
      message: "Xóa công việc thành công"
    });
  } catch (error) {
    console.error("Lỗi xóa công việc:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa công việc"
    });
  }
};

module.exports = {
  getTodayTasks,
  createTask,
  updateTask,
  deleteTask
};
