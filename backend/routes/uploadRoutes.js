const express = require("express");
const router = express.Router();
const { upload, uploadBuffer } = require("../config/cloudinary");
const { protect } = require("../middleware/authMiddleware");
const {
  IMAGE_UPLOAD_TYPES,
  validateUploadedFile,
} = require("../middleware/secureUpload");

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file ảnh" });
    }
    const uploaded = await uploadBuffer(req.file.buffer);
    return res.json({ url: uploaded.secure_url });
  } catch (err) {
    return res.status(500).json({ message: "Upload thất bại", error: err.message });
  }
};

router.post(
  "/avatar",
  protect,
  upload.single("avatar"),
  validateUploadedFile(IMAGE_UPLOAD_TYPES),
  uploadAvatar
);

module.exports = router;
