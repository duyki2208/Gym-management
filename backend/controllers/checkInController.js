const CheckIn = require("../models/CheckIn");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const faceClient = require("../utils/faceServiceClient");
const { sendZaloNotification } = require("../utils/zaloService");
const queueService = require("../utils/queueService");

// Cache embeddings trong memory, refresh mỗi 5 phút
// Tránh query MongoDB mỗi lần có người đứng trước camera
let embeddingCache = [];
let cacheFetchedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

async function getEmbeddingCandidates() {
  if (Date.now() - cacheFetchedAt < CACHE_TTL_MS && embeddingCache.length > 0) {
    return embeddingCache;
  }
  const customers = await Customer.find(
    { faceEmbedding: { $exists: true, $not: { $size: 0 } } },
    '_id name code faceEmbedding packageType endDate activePackage'
  ).populate('activePackage', 'status').lean();

  embeddingCache = customers.map(c => ({
    member_id: c._id.toString(),
    embedding: c.faceEmbedding,
    // metadata không gửi lên Python, giữ ở Node.js để lookup sau
    _meta: { 
      name: c.name, 
      code: c.code, 
      packageType: c.packageType, 
      endDate: c.endDate,
      status: c.activePackage?.status || 'active'
    },
  }));
  cacheFetchedAt = Date.now();
  return embeddingCache;
}

// Invalidate cache khi có cập nhật embedding mới
function invalidateEmbeddingCache() {
  cacheFetchedAt = 0;
}


// Lấy danh sách khách hàng dành riêng cho trang Check-in
// KHÔNG trả về faceDescriptor — chỉ lấy fields cần thiết để hiển thị
const getCheckInList = async (req, res) => {
  try {
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
      .select("_id name code phone packageType startDate endDate avatar activePackage") // Lấy thêm activePackage
      .populate("activePackage", "status") // Populate status
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

// Tạo mới check-in
const create = async (req, res) => {
  try {
    const { customerId, time } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Thiếu customerId" });
    }

    let customer = await Customer.findById(customerId);
    if (!customer) {
      // Fallback nếu client truyền lên ID gói tập thay vì ID hội viên
      const pkg = await CustomerPackage.findById(customerId);
      if (pkg && pkg.customer) {
        customer = await Customer.findById(pkg.customer);
      }
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    }

    const checkin = new CheckIn({
      customerId: customer._id,
      customerName: customer.name,
      customerCode: customer.code,
      packageType: customer.packageType,
      time: time || new Date(),
    });
    await checkin.save();

    // Gửi tin nhắn Zalo OA bất đồng bộ qua Queue ngầm (Non-blocking response)
    if (customer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: customer.phone,
        message: `Kính chào ${customer.name}, quý khách đã check-in thành công tại phòng tập lúc ${new Date().toLocaleTimeString("vi-VN")}. Chúc quý khách tập luyện vui vẻ!`,
        type: "checkin"
      });
    }

    res.status(201).json({ success: true, data: checkin, message: "Check-in thành công" });
  } catch (error) {
    console.error("Lỗi tạo check-in:", error);
    res.status(500).json({ success: false, message: "Lỗi tạo check-in" });
  }
};


/**
 * @desc  Nhận diện khuôn mặt từ frame camera và check-in tự động
 * @route POST /api/v1/checkins/recognize
 * @access Private
 */
const recognizeFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Thiếu ảnh" });
    }

    // Lấy tất cả candidates có faceEmbedding (có cache)
    const candidates = await getEmbeddingCandidates();

    if (candidates.length === 0) {
      return res.json({
        success: true,
        matched: false,
        reason: 'no_enrolled_faces',
        message: 'Chưa có khách hàng nào đã đăng ký khuôn mặt'
      });
    }

    // Chỉ gửi member_id + embedding lên Python (không gửi _meta)
    const candidatesForPython = candidates.map(c => ({
      member_id: c.member_id,
      embedding: c.embedding,
    }));

    // Gọi Python InsightFace service
    const result = await faceClient.recognize(req.file.buffer, candidatesForPython);

    if (!result.matched) {
      return res.json({
        success: true,
        matched: false,
        reason: result.reason,
        confidence: result.best_confidence,
      });
    }

    // Tìm metadata của khách hàng đã khớp từ cache
    const matchedCandidate = candidates.find(c => c.member_id === result.member_id);
    const meta = matchedCandidate?._meta || {};

    // Ghi lịch sử check-in
    const checkin = new CheckIn({
      customerId: result.member_id,
      customerName: meta.name || '',
      customerCode: meta.code || '',
      packageType: meta.packageType || '',
      time: new Date(),
    });
    await checkin.save();

    // Gửi tin nhắn Zalo OA bất đồng bộ qua Queue ngầm (Non-blocking response)
    const matchedCustomer = await Customer.findById(result.member_id).select("phone name");
    if (matchedCustomer && matchedCustomer.phone) {
      queueService.enqueue("ZALO_NOTIFICATION", {
        phone: matchedCustomer.phone,
        message: `Kính chào ${matchedCustomer.name}, quý khách đã check-in thành công bằng nhận diện khuôn mặt lúc ${new Date().toLocaleTimeString("vi-VN")}. Chúc quý khách tập luyện vui vẻ!`,
        type: "checkin"
      });
    }

    // Kiểm tra cảnh báo hết hạn hoặc bảo lưu gói tập
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
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ nhận diện khuôn mặt chưa khởi động. Vui lòng chạy face-service trước.',
      });
    }
    console.error('recognizeFace error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, create, getCheckInList, recognizeFace, invalidateEmbeddingCache };

