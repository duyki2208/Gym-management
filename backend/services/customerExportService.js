const ExcelJS = require("exceljs");
const { escapeRegex } = require("./customerLookupService");

class CustomerExportError extends Error {
  constructor(message) {
    super(message);
    this.name = "CustomerExportError";
    this.statusCode = 400;
  }
}

const parseDate = (value, field) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new CustomerExportError(`${field} không hợp lệ`);
  return parsed;
};

const buildExportQuery = async ({ Customer, filters, now = new Date() }) => {
  const andConditions = [];
  if (filters.search) {
    const pattern = escapeRegex(String(filters.search).trim());
    const customers = await Customer.find({
      $or: ["name", "phone", "code"].map((field) => ({
        [field]: { $regex: pattern, $options: "i" },
      })),
    }).select("_id").lean();
    andConditions.push({ customer: { $in: customers.map((item) => item._id) } });
  }

  if (filters.preset === "today_call") {
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    andConditions.push({
      $or: [
        { endDate: { $gte: now, $lte: sevenDaysLater }, status: "active" },
        { paymentStatus: "deposit" },
      ],
    });
  } else {
    if (filters.expiringDays !== undefined && filters.expiringDays !== "") {
      const days = Number(filters.expiringDays);
      if (!Number.isInteger(days) || days < 0 || days > 3650) {
        throw new CustomerExportError("expiringDays phải là số nguyên trong khoảng 0..3650");
      }
      andConditions.push({
        endDate: { $gte: now, $lte: new Date(now.getTime() + days * 24 * 60 * 60 * 1000) },
        status: "active",
      });
    }
    if (filters.paymentStatus && filters.paymentStatus !== "all") andConditions.push({ paymentStatus: filters.paymentStatus });
    if (filters.hasNoPT === "true" || filters.hasNoPT === true) {
      andConditions.push({ $or: [{ trainer: null }, { trainer: { $exists: false } }] });
    }
    if (filters.trainerId && filters.trainerId !== "all") andConditions.push({ trainer: filters.trainerId });
    if (filters.assignedStaffId && filters.assignedStaffId !== "all") andConditions.push({ assignedStaff: filters.assignedStaffId });
    if (filters.packageName && filters.packageName !== "all") andConditions.push({ packageName: filters.packageName });
    if (filters.startDateFrom || filters.startDateTo) {
      const startDate = {};
      const from = parseDate(filters.startDateFrom, "startDateFrom");
      const to = parseDate(filters.startDateTo, "startDateTo");
      if (from) startDate.$gte = from;
      if (to) startDate.$lte = to;
      if (from && to && from > to) throw new CustomerExportError("Khoảng ngày bắt đầu không hợp lệ");
      andConditions.push({ startDate });
    }
  }
  return andConditions.length ? { $and: andConditions } : {};
};

const loadExportPackages = async ({ Customer, CustomerPackage, filters, now }) => {
  const query = await buildExportQuery({ Customer, filters, now });
  return CustomerPackage.find(query)
    .populate("customer")
    .populate("assignedStaff", "fullName role")
    .populate("trainer", "fullName username role")
    .sort({ endDate: 1 })
    .lean();
};

const createCustomerWorkbook = ({ packages, now = new Date() }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GymPro Management System";
  workbook.created = now;
  const worksheet = workbook.addWorksheet("Danh Sách Khách Hàng");

  worksheet.mergeCells("A1:K1");
  const title = worksheet.getCell("A1");
  title.value = "DANH SÁCH KHÁCH HÀNG / HỘI VIÊN GYMPRO";
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 40;

  worksheet.mergeCells("A2:K2");
  const subtitle = worksheet.getCell("A2");
  subtitle.value = `Thời gian xuất: ${now.toLocaleString("vi-VN")} | Tổng số bản ghi: ${packages.length}`;
  subtitle.font = { name: "Calibri", size: 10, italic: true, color: { argb: "475569" } };
  subtitle.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 20;
  worksheet.addRow([]);

  const header = worksheet.addRow([
    "STT", "Mã KH", "Họ và Tên", "Số Điện Thoại", "Gói Tập", "Ngày Hết Hạn",
    "Còn (Ngày)", "PT Phụ Trách", "Sale Phụ Trách", "Trạng Thái TT", "Ghi Chú Gói",
  ]);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "CBD5E1" } },
      bottom: { style: "medium", color: { argb: "1E40AF" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };
  });

  packages.forEach((pkg, index) => {
    const customer = pkg.customer || {};
    const endDate = pkg.endDate ? new Date(pkg.endDate) : null;
    const remainingDays = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : 0;
    const paymentText = pkg.paymentStatus === "deposit" ? "Đặt cọc (Nợ)" : pkg.paymentStatus === "unpaid" ? "Chưa TT" : "Đã TT";
    const row = worksheet.addRow([
      index + 1, customer.code || "N/A", customer.name || "N/A", customer.phone || "N/A",
      pkg.packageName || "N/A", endDate ? endDate.toLocaleDateString("vi-VN") : "N/A", remainingDays,
      pkg.trainer?.fullName || "Chưa gán", pkg.assignedStaff?.fullName || "Chưa gán", paymentText, pkg.packageNote || "",
    ]);
    row.height = 22;
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: "Calibri", size: 11 };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } },
      };
      cell.alignment = {
        horizontal: [1, 2, 4, 6, 7, 10].includes(columnNumber) ? "center" : "left",
        vertical: "middle",
      };
    });
    if (remainingDays >= 0 && remainingDays <= 7 && pkg.status === "active") {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
      row.getCell(7).font = { color: { argb: "991B1B" }, bold: true };
    } else if (remainingDays < 0) {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F4F6" } };
      row.getCell(7).font = { color: { argb: "6B7280" } };
    }
    if (pkg.paymentStatus === "deposit") {
      row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      row.getCell(10).font = { color: { argb: "92400E" }, bold: true };
    }
  });

  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, cell.value ? String(cell.value).length : 0);
    });
    column.width = Math.min(maxLength + 4, 35);
  });
  return workbook;
};

module.exports = {
  CustomerExportError,
  buildExportQuery,
  loadExportPackages,
  createCustomerWorkbook,
};
