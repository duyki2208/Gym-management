const express = require("express");
const router = express.Router();
const { getTodayTasks, createTask, updateTask, deleteTask } = require("../controllers/teamTaskController");
const { protect } = require("../middleware/authMiddleware");
const {
  PERMISSIONS,
  requirePermission,
  requireAnyPermission,
} = require("../middleware/permissions");

// Tất cả các routes đều yêu cầu đăng nhập
router.use(protect);

router.route("/")
  .get(requirePermission(PERMISSIONS.TEAM_TASK_READ), getTodayTasks)
  .post(requirePermission(PERMISSIONS.TEAM_TASK_MANAGE), createTask);

router.put(
  "/:id",
  requireAnyPermission(PERMISSIONS.TEAM_TASK_MANAGE, PERMISSIONS.TEAM_TASK_COMPLETE),
  updateTask
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.TEAM_TASK_MANAGE),
  deleteTask
);

module.exports = router;
