const TeamTask = require("../models/TeamTask");
const { format } = require("date-fns");
const { PERMISSIONS, userHasPermission } = require("../middleware/permissions");
const {
  getVisibleTeams,
  resolveRequestedTeam,
  canAccessTeam,
} = require("../services/teamTaskAccessService");

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
    let query = { date: todayStr };
    const visibleTeams = getVisibleTeams(req.user.role);
    if (visibleTeams.length === 0) return res.status(403).json({ success: false, message: "Không có phạm vi đội được cấp" });
    if (req.query.team) {
      if (!visibleTeams.includes(req.query.team)) return res.status(403).json({ success: false, message: "Không có quyền xem đội này" });
      query.team = req.query.team;
    } else if (visibleTeams.length === 1) query.team = visibleTeams[0];
    else query.team = { $in: visibleTeams };

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

    if (!timeSlot || !task) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ khung giờ và nội dung công việc"
      });
    }

    // Xác định team cho task dựa trên role của người tạo
    const taskTeam = resolveRequestedTeam(req.user.role, team);
    if (!taskTeam) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn đội (team) hợp lệ trong phạm vi được cấp"
      });
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

    const currentTask = await TeamTask.findById(id);
    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công việc"
      });
    }

    if (!canAccessTeam(req.user.role, currentTask.team)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền cập nhật công việc này!"
      });
    }

    const canManage = await userHasPermission(req, PERMISSIONS.TEAM_TASK_MANAGE);
    if (!canManage) {
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

    const task = await TeamTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công việc"
      });
    }

    if (!canAccessTeam(req.user.role, task.team)) {
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
