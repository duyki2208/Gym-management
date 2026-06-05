const express = require("express");
const router = express.Router();
const { getTodayTasks, createTask, updateTask, deleteTask } = require("../controllers/teamTaskController");
const { protect } = require("../middleware/authMiddleware");

// Tất cả các routes đều yêu cầu đăng nhập
router.use(protect);

router.route("/")
  .get(getTodayTasks)
  .post(createTask);

router.route("/:id")
  .put(updateTask)
  .delete(deleteTask);

module.exports = router;
