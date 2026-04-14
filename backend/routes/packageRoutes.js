const express = require("express");
const router = express.Router();
const packageController = require("../controllers/packageController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Lấy tất cả gói tập (Mọi nhân viên đã đăng nhập đều xem được)
router.get("/", protect, packageController.getAllPackages);

// Thêm mới gói tập (Chỉ Admin/Manager)
router.post("/", protect, authorize("admin", "manager"), packageController.createPackage);

// Xóa gói tập (Chỉ Admin/Manager)
router.delete("/:id", protect, authorize("admin", "manager"), packageController.deletePackage);

// Sửa gói tập (Chỉ Admin/Manager)
router.put("/:id", protect, authorize("admin", "manager"), packageController.updatePackage);

module.exports = router;
