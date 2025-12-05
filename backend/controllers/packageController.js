const Package = require("../models/Package");

// Lấy tất cả gói tập
exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find({}).sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm mới gói tập
exports.createPackage = async (req, res) => {
  const { name, duration, price } = req.body;
  try {
    const pkg = await Package.create({ name, duration, price });
    res.status(201).json(pkg);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Xóa gói tập
exports.deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (pkg) {
      await pkg.deleteOne();
      res.json({ message: "Đã xóa gói tập" });
    } else {
      res.status(404).json({ message: "Không tìm thấy gói tập" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sửa gói tập
exports.updatePackage = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (pkg) {
      pkg.name = req.body.name || pkg.name;
      pkg.duration = req.body.duration || pkg.duration;
      pkg.price = req.body.price || pkg.price;
      await pkg.save();
      res.json(pkg);
    } else {
      res.status(404).json({ message: "Không tìm thấy gói tập" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
