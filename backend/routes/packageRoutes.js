const express = require("express");
const router = express.Router();
const packageController = require("../controllers/packageController");

// Lấy tất cả gói tập
router.get("/", packageController.getAllPackages);

// Thêm mới gói tập
router.post("/", packageController.createPackage);

// Xóa gói tập
router.delete("/:id", packageController.deletePackage);

// Sửa gói tập
router.put("/:id", packageController.updatePackage);

module.exports = router;
