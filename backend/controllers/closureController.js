const ClosureEvent = require("../models/ClosureEvent");
const CustomerPackage = require("../models/CustomerPackage");
const Customer = require("../models/Customer");
const AuditLog = require("../models/AuditLog");
const Setting = require("../models/Setting");
const { sendCustomEmailWithAttachment } = require("../utils/emailService");
const { format } = require("date-fns");

// Helper: Chuẩn hóa ngày về đầu ngày (00:00:00.000) và cuối ngày (23:59:59.999)
const toStartOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

// Helper tính toán số ngày overlap giữa gói tập và đợt đóng cửa
const calculateOverlapDays = (pkgStart, pkgEnd, closureStart, closureEnd) => {
  const pStart = toStartOfDay(pkgStart);
  const pEnd = toEndOfDay(pkgEnd);
  const cStart = toStartOfDay(closureStart);
  const cEnd = toEndOfDay(closureEnd);

  const overlapStart = pStart > cStart ? pStart : cStart;
  const overlapEnd = pEnd < cEnd ? pEnd : cEnd;

  if (overlapEnd >= overlapStart) {
    const diffMs = overlapEnd.getTime() - overlapStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }
  return 0;
};

// @desc    Lấy danh sách sự kiện đóng cửa theo chi nhánh
// @route   GET /api/v1/closures
// @access  Private (Admin, Manager)
const getAllClosures = async (req, res) => {
  try {
    const branchCode = req.branchCode || req.user?.activeBranch || "HN01";
    const closures = await ClosureEvent.find({ branchCode })
      .populate("createdBy", "fullName username role")
      .populate("compensationStats.reversedBy", "fullName username role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: closures,
      message: "Lấy danh sách sự kiện đóng cửa thành công",
    });
  } catch (error) {
    console.error("Lỗi getAllClosures:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi lấy danh sách sự kiện đóng cửa",
    });
  }
};

// @desc    Lấy chi tiết sự kiện đóng cửa & danh sách hợp đồng được bù hạn
// @route   GET /api/v1/closures/:id
// @access  Private (Admin, Manager)
const getClosureDetails = async (req, res) => {
  try {
    const closure = await ClosureEvent.findById(req.params.id)
      .populate("createdBy", "fullName username role")
      .populate("compensationStats.reversedBy", "fullName username role");

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện đóng cửa này",
      });
    }

    // Lấy các gói tập đã được bù hạn bởi sự kiện này
    const affectedPackages = await CustomerPackage.find({
      "appliedClosures.closureEventId": closure._id,
    })
      .populate("customer", "name phone email code")
      .select("packageName contractCode startDate endDate status appliedClosures customer")
      .lean();

    const formattedPackages = affectedPackages.map((pkg) => {
      const entry = (pkg.appliedClosures || []).find(
        (c) => c.closureEventId.toString() === closure._id.toString()
      );
      return {
        _id: pkg._id,
        packageName: pkg.packageName,
        contractCode: pkg.contractCode,
        customerName: pkg.customer?.name || "Hội viên",
        customerPhone: pkg.customer?.phone || "",
        customerEmail: pkg.customer?.email || "",
        customerCode: pkg.customer?.code || "",
        daysAdded: entry?.daysAdded || 0,
        previousEndDate: entry?.previousEndDate,
        newEndDate: entry?.newEndDate || pkg.endDate,
        appliedAt: entry?.appliedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        closure,
        affectedPackages: formattedPackages,
      },
      message: "Lấy chi tiết sự kiện đóng cửa thành công",
    });
  } catch (error) {
    console.error("Lỗi getClosureDetails:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi lấy chi tiết sự kiện đóng cửa",
    });
  }
};

// @desc    Xem trước (Preview) số lượng gói và ngày bù trước khi tạo sự kiện
// @route   POST /api/v1/closures/preview
// @access  Private (Admin, Manager)
const previewClosureCompensation = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ngày bắt đầu và ngày kết thúc",
      });
    }

    const cStart = toStartOfDay(startDate);
    const cEnd = toEndOfDay(endDate);

    if (cEnd < cStart) {
      return res.status(400).json({
        success: false,
        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
      });
    }

    // Query các gói active có startDate <= cEnd và endDate >= cStart
    const activePackages = await CustomerPackage.find({
      status: "active",
      isDeleted: { $ne: true },
      startDate: { $lte: cEnd },
      endDate: { $gte: cStart },
    })
      .populate("customer", "name phone email code")
      .select("packageName contractCode startDate endDate customer")
      .lean();

    let totalPackages = 0;
    let totalDaysAdded = 0;
    const uniqueCustomerIds = new Set();
    const previewList = [];

    for (const pkg of activePackages) {
      const days = calculateOverlapDays(pkg.startDate, pkg.endDate, cStart, cEnd);
      if (days > 0) {
        totalPackages++;
        totalDaysAdded += days;
        if (pkg.customer?._id) {
          uniqueCustomerIds.add(pkg.customer._id.toString());
        }

        const prevEndDate = new Date(pkg.endDate);
        const projectedEndDate = new Date(prevEndDate.getTime() + days * 24 * 60 * 60 * 1000);

        if (previewList.length < 50) {
          previewList.push({
            packageId: pkg._id,
            packageName: pkg.packageName,
            contractCode: pkg.contractCode,
            customerName: pkg.customer?.name || "Hội viên",
            customerPhone: pkg.customer?.phone || "",
            customerEmail: pkg.customer?.email || "",
            daysToAdd: days,
            currentEndDate: prevEndDate,
            projectedEndDate,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalPackages,
        totalCustomers: uniqueCustomerIds.size,
        totalDaysAdded,
        samplePreview: previewList,
      },
      message: "Tính toán trước danh sách bù hạn thành công",
    });
  } catch (error) {
    console.error("Lỗi previewClosureCompensation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi xem trước bù hạn",
    });
  }
};

// @desc    Tạo sự kiện đóng cửa và thực thi bù hạn gói tập
// @route   POST /api/v1/closures
// @access  Private (Admin, Manager)
const closureMutations = require("../services/closureMutationService");
const mongoose = require("mongoose");
const closureModels = req => req.models || { Customer, CustomerPackage, ClosureEvent, connection: mongoose.connection };
const mutateClosure = action => async (req, res) => {
  try {
    const closure = await closureMutations[action]({
      models: closureModels(req), data: req.body, id: req.params.id,
      branchCode: req.branchCode || req.user?.activeBranch || "HN01", actorId: req.user?._id,
    });
    await AuditLog.create({ user: req.user?._id, action: `${action}: ${closure.title}`, target: closure._id, targetModel: "ClosureEvent", ipAddress: req.ip }).catch(error => console.warn("Lỗi ghi audit closure:", error.message));
    res.status(action === "createClosure" ? 201 : 200).json({ success: true, data: closure,
      message: action === "createClosure" ? "Đã bù hạn và đồng bộ hồ sơ hội viên." : "Đã hoàn tác số ngày bù của sự kiện." });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, code: error.code, message: error.message });
  }
};
const createClosure = mutateClosure("createClosure");
const reverseClosure = mutateClosure("reverseClosure");

// @desc    Gửi mail thông báo đóng cửa chi nhánh (soạn tự do kiểu Gmail + đính kèm file)
// @route   POST /api/v1/closures/:id/send-email
// @access  Private (Admin, Manager)
const sendClosureNotificationEmail = async (req, res) => {
  try {
    const { subject, body } = req.body;
    const closure = await ClosureEvent.findById(req.params.id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện đóng cửa",
      });
    }

    if (!subject || !subject.trim() || !body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ tiêu đề và nội dung email thông báo",
      });
    }

    // Lấy thông tin phòng tập / chi nhánh từ Setting
    const setting = await Setting.findOne();
    const branchName = setting?.gymName || "Gym Fitness";

    // Tìm danh sách khách hàng có gói chịu ảnh hưởng từ closure này
    const affectedPackages = await CustomerPackage.find({
      "appliedClosures.closureEventId": closure._id,
    }).populate("customer");

    // Lọc ra các khách hàng duy nhất có email hợp lệ
    const customerMap = new Map();
    for (const pkg of affectedPackages) {
      if (pkg.customer && pkg.customer.email && pkg.customer.email.includes("@")) {
        const custId = pkg.customer._id.toString();
        if (!customerMap.has(custId)) {
          customerMap.set(custId, {
            customer: pkg.customer,
            newEndDate: pkg.endDate,
          });
        }
      }
    }

    const recipients = Array.from(customerMap.values());

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy hội viên nào có email hợp lệ trong danh sách được bù hạn đợt này",
      });
    }

    // Xử lý file đính kèm nếu có upload qua Multer
    let attachment = null;
    let attachmentName = "";
    if (req.file) {
      attachment = {
        content: req.file.buffer.toString("base64"),
        name: req.file.originalname,
      };
      attachmentName = req.file.originalname;
    }

    // Đánh dấu trạng thái gửi mail
    closure.mailNotification = {
      subject: subject.trim(),
      body: body.trim(),
      attachmentName,
      status: "sending",
      sentCount: 0,
      failedCount: 0,
      sentAt: null,
    };
    await closure.save();

    // Phản hồi HTTP ngay cho client, xử lý gửi ngầm (Background Execution)
    res.status(200).json({
      success: true,
      message: `Đang bắt đầu gửi email thông báo tới ${recipients.length} hội viên...`,
      data: {
        totalRecipients: recipients.length,
        attachmentName: attachmentName || null,
      },
    });

    // --- TIẾN TRÌNH GỬI MAIL NGẦM THEO BATCH ---
    setImmediate(async () => {
      let sentCount = 0;
      let failedCount = 0;

      const formattedStartDate = format(new Date(closure.startDate), "dd/MM/yyyy");
      const formattedEndDate = format(new Date(closure.endDate), "dd/MM/yyyy");

      for (const { customer, newEndDate } of recipients) {
        try {
          const custName = customer.name || "Quý hội viên";
          const formattedNewEndDate = newEndDate ? format(new Date(newEndDate), "dd/MM/yyyy") : "Đã cập nhật";

          // Thay thế các placeholder tùy chọn
          let personalizedBody = body
            .replace(/\{\{ten_khach_hang\}\}/gi, custName)
            .replace(/\{\{ten_chi_nhanh\}\}/gi, branchName)
            .replace(/\{\{han_moi\}\}/gi, formattedNewEndDate)
            .replace(/\{\{ngay_dong\}\}/gi, formattedStartDate)
            .replace(/\{\{ngay_mo\}\}/gi, formattedEndDate)
            .replace(/\{\{ly_do\}\}/gi, closure.reason);

          let personalizedSubject = subject
            .replace(/\{\{ten_khach_hang\}\}/gi, custName)
            .replace(/\{\{ten_chi_nhanh\}\}/gi, branchName);

          // Bọc nội dung vào khung HTML sạch đẹp
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #0abf69 0%, #059669 100%); padding: 24px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px;">${branchName}</h2>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Thông báo từ Ban Quản Lý Phòng Tập</p>
              </div>
              <div style="padding: 24px 28px; line-height: 1.7; color: #334155; font-size: 15px; white-space: pre-line;">
${personalizedBody}
              </div>
              <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center;">
                <p style="margin: 0;">Mọi thắc mắc xin vui lòng liên hệ trực tiếp quầy lễ tân hoặc hotline chi nhánh.</p>
                <p style="margin: 4px 0 0 0; font-weight: bold; color: #0abf69;">${branchName} trân trọng cảm ơn sự đồng hành của bạn!</p>
              </div>
            </div>
          `;

          const success = await sendCustomEmailWithAttachment({
            toEmail: customer.email,
            toName: custName,
            subject: personalizedSubject,
            htmlContent,
            attachments: attachment ? [attachment] : [],
          });

          if (success) {
            sentCount++;
          } else {
            failedCount++;
          }

          // Delay nhỏ 120ms giữa các email để chống rate-limit
          await new Promise((r) => setTimeout(r, 120));
        } catch (mailErr) {
          console.error(`Lỗi gửi mail cho ${customer.email}:`, mailErr.message);
          failedCount++;
        }
      }

      // Cập nhật kết quả cuối cùng
      try {
        const freshClosure = await ClosureEvent.findById(closure._id);
        if (freshClosure) {
          freshClosure.mailNotification.status = "completed";
          freshClosure.mailNotification.sentCount = sentCount;
          freshClosure.mailNotification.failedCount = failedCount;
          freshClosure.mailNotification.sentAt = new Date();
          await freshClosure.save();
        }
      } catch (saveErr) {
        console.error("Lỗi cập nhật trạng thái gửi mail closure:", saveErr.message);
      }
    });
  } catch (error) {
    console.error("Lỗi sendClosureNotificationEmail:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi gửi thông báo",
    });
  }
};

// @desc    Lấy tiến độ gửi email thông báo
// @route   GET /api/v1/closures/:id/mail-progress
// @access  Private (Admin, Manager)
const getMailProgress = async (req, res) => {
  try {
    const closure = await ClosureEvent.findById(req.params.id).select("mailNotification");
    if (!closure) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện đóng cửa",
      });
    }

    return res.status(200).json({
      success: true,
      data: closure.mailNotification || {},
      message: "Lấy tiến độ gửi mail thành công",
    });
  } catch (error) {
    console.error("Lỗi getMailProgress:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi lấy tiến độ gửi mail",
    });
  }
};

module.exports = {
  getAllClosures,
  getClosureDetails,
  previewClosureCompensation,
  createClosure,
  reverseClosure,
  sendClosureNotificationEmail,
  getMailProgress,
};
