const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const { protect } = require("../middleware/authMiddleware");

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file ảnh" });
    }
    // req.file.path là URL Cloudinary (do multer-storage-cloudinary xử lý)
    return res.json({ url: req.file.path });
  } catch (err) {
    return res.status(500).json({ message: "Upload thất bại", error: err.message });
  }
};

router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);

module.exports = router;
