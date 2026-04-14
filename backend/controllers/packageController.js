const Package = require("../models/Package");
const asyncHandler = require("../middleware/asyncHandler");

// Lấy tất cả gói tập
exports.getAllPackages = asyncHandler(async (req, res) => {
  const packages = await Package.find({}).sort({ createdAt: -1 }).lean();
  res.json(packages);
});

// Thêm mới gói tập
exports.createPackage = asyncHandler(async (req, res) => {
  const { name, duration, price, type, sessions } = req.body;
  const pkg = await Package.create({ name, duration, price, type, sessions });
  res.status(201).json(pkg);
});

// Xóa gói tập
exports.deletePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (pkg) {
    await pkg.deleteOne();
    res.json({ message: "Đã xóa gói tập" });
  } else {
    res.status(404);
    throw new Error("Không tìm thấy gói tập");
  }
});

// Sửa gói tập
exports.updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (pkg) {
    pkg.name = req.body.name || pkg.name;
    pkg.duration = req.body.duration || pkg.duration;
    pkg.price = req.body.price || pkg.price;
    pkg.type = req.body.type || pkg.type;
    if (req.body.sessions !== undefined) {
      pkg.sessions = req.body.sessions;
    }
    await pkg.save();
    res.json(pkg);
  } else {
    res.status(404);
    throw new Error("Không tìm thấy gói tập");
  }
});
