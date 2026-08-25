/**
 * backend/controllers/checkInController.js
 * Quản lý Check-In và Nhận diện khuôn mặt theo Chi nhánh Độc lập (Multi-Branch)
 */
const faceClient = require("../utils/faceServiceClient");
const { sendZaloNotification } = require("../utils/zaloService");
const queueService = require("../utils/queueService");

// Cache embeddings theo từng chi nhánh: Map<branchCode, { data: [], fetchedAt: number }>
const embeddingCacheMap = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

async function getEmbeddingCandidatesForBranch(models, branchCode) {
  const normalizedBranch = (branchCode || "HN01").toUpperCase();
  const cached = embeddingCacheMap.get(normalizedBranch);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data.length > 0) {
    return cached.data;
  }

  const customers = await models.Customer.find(
    { faceEmbedding: { $exists: true, $not: { $size: 0 } } },
    "_id name code faceEmbedding packageType endDate activePackage"
  )
    .populate("activePackage", "status")
    .lean();

  const formattedCandidates = [];
  for (const c of customers) {
    let status = c.activePackage?.status || "active";
    if (!c.activePackage) {
      const latestPkg = await models.CustomerPackage.findOne({
        customer: c._id,
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .select("status")
        .lean();
      if (latestPkg?.status === "transferred") {
        status = "transferred";
      }
    }
    formattedCandidates.push({
      member_id: c._id.toString(),
      embedding: c.faceEmbedding,
      _meta: {
        name: c.name,
        code: c.code,
        packageType: c.packageType,
        endDate: c.endDate,
        status: status,
      },
    });
  }

  embeddingCacheMap.set(normalizedBranch, {
    data: formattedCandidates,
    fetchedAt: Date.now(),
  });

  return formattedCandidates;
}

// Invalidate cache khi có cập nhật embedding mới
function invalidateEmbeddingCache(branchCode = null) {
  if (branchCode) {
    embeddingCacheMap.delete(branchCode.toUpperCase());
  } else {
    embeddingCacheMap.clear();
  }
}

// Lấy danh sách khách hàng dành riêng cho trang Check-in
const getCheckInList = async (req, res) => {
  try {
    const Customer = req.models.Customer;
    const { search = "", page = 1, limit = 50 } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query)
      .select("_id name code phone packageType startDate endDate avatar activePackage")
      .populate("activePackage", "status")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: {
        customers,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách check-in:", error);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách khách hàng" });
  }
};

// Lấy tất cả lịch sử check-in (có phân trang)
const getAll = async (req, res) => {
  try {
    const CheckIn = req.models.CheckIn;
    const { page = 1, limit = 50 } = req.query;
    const checkins = await CheckIn.find()
      .sort({ time: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await CheckIn.countDocuments();

    res.json({
      success: true,
      data: {
        checkins,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử check-in:", error);
    res.status(500).json({ success: false, message: "Lỗi lấy lịch sử check-in" });
  }
};

// Tạo mới check-in thủ công
const create = async (req, res) => {
  try {
    const Customer = req.models.Customer;
    const CustomerPackage = req.models.CustomerPackage;
    const CheckIn = req.models.CheckIn;

    const { customerId, time } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Thiếu customerId" });
    }

    let customer = await Customer.findById(customerId);
    if (!customer) {
      const pkg = await CustomerPackage.findById(customerId);
      if (pkg && pkg.customer) {
        customer = await Customer.findById(pkg.customer);
      }
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    }

    // Kiểm tra hợp đồng đã chuyển nhượng chưa
    const activePkg = await CustomerPackage.findOne({
      customer: customer._id,
      status: "active",
      isDeleted: { $ne: true },
    });
    const latestPkg = await CustomerPackage.findOne({
      customer: customer._id,
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 });

    if ((!activePkg && latestPkg?.status === "transferred") || activePkg?.status === "transferred") {
      return res.status(400).json({
        success: false,
        message: `Hợp đồng của hội viên "${customer.name}" đã được chuyển nhượng. Không thể thực hiện check-in.`,
      });
    }

    const checkin = new CheckIn({
      customerId: customer._id,
      customerName: customer.name,
      customerCode: customer.code,
      packageType: customer.packageType,
      time: time || new Date(),
    });
    await checkin.save();

    if (customer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: customer.phone,
        message: `Kính chào ${customer.name}, quý khách đã check-in thành công tại phòng tập lúc ${new Date().toLocaleTimeString(
          "vi-VN"
        )}. Chúc quý khách tập luyện vui vẻ!`,
        type: "checkin",
      });
    }

    res.status(201).json({ success: true, data: checkin, message: "Check-in thành công" });
  } catch (error) {
    console.error("Lỗi tạo check-in:", error);
    res.status(500).json({ success: false, message: "Lỗi tạo check-in" });
  }
};

// Nhận diện khuôn mặt từ frame camera và check-in tự động
const recognizeFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Thiếu ảnh" });
    }

    const branchCode = req.branchCode || "HN01";
    const candidates = await getEmbeddingCandidatesForBranch(req.models, branchCode);

    if (candidates.length === 0) {
      return res.json({
        success: true,
        matched: false,
        reason: "no_enrolled_faces",
        message: "Chưa có khách hàng nào tại chi nhánh này đã đăng ký khuôn mặt",
      });
    }

    const candidatesForPython = candidates.map((c) => ({
      member_id: c.member_id,
      embedding: c.embedding,
    }));

    const result = await faceClient.recognize(req.file.buffer, candidatesForPython, branchCode);

    if (!result.matched) {
      return res.json({
        success: true,
        matched: false,
        reason: result.reason,
        confidence: result.best_confidence,
      });
    }

    const matchedCandidate = candidates.find((c) => c.member_id === result.member_id);
    const meta = matchedCandidate?._meta || {};

    if (meta.status === "transferred") {
      return res.json({
        success: true,
        matched: true,
        rejected: true,
        warning: "transferred",
        message: `Hợp đồng của hội viên "${meta.name}" đã được chuyển nhượng. Từ chối check-in!`,
        member: {
          _id: result.member_id,
          name: meta.name,
          code: meta.code,
          packageType: meta.packageType,
          endDate: meta.endDate,
          status: "transferred",
        },
      });
    }

    const CheckIn = req.models.CheckIn;
    const Customer = req.models.Customer;

    const checkin = new CheckIn({
      customerId: result.member_id,
      customerName: meta.name || "",
      customerCode: meta.code || "",
      packageType: meta.packageType || "",
      time: new Date(),
    });
    await checkin.save();

    const matchedCustomer = await Customer.findById(result.member_id).select("phone name");
    if (matchedCustomer && matchedCustomer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: matchedCustomer.phone,
        message: `Kính chào ${matchedCustomer.name}, quý khách đã check-in thành công bằng nhận diện khuôn mặt lúc ${new Date().toLocaleTimeString(
          "vi-VN"
        )}. Chúc quý khách tập luyện vui vẻ!`,
        type: "checkin",
      });
    }

    const today = new Date();
    let warning = null;
    if (meta.endDate && new Date(meta.endDate) < today) {
      warning = "expired";
    } else if (meta.status === "frozen") {
      warning = "frozen";
    }

    res.json({
      success: true,
      matched: true,
      confidence: result.confidence,
      warning,
      member: {
        _id: result.member_id,
        name: meta.name,
        code: meta.code,
        packageType: meta.packageType,
        endDate: meta.endDate,
      },
      checkinId: checkin._id,
    });
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ECONNABORTED") {
      return res.status(503).json({
        success: false,
        message: "Dịch vụ nhận diện khuôn mặt chưa khởi động. Vui lòng chạy face-service trước.",
      });
    }
    console.error("recognizeFace error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, create, getCheckInList, recognizeFace, invalidateEmbeddingCache };
