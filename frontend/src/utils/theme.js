// Theme và màu sắc chuẩn cho biểu đồ hệ thống (Recharts)
// Đồng bộ 100% với DESIGN.md và tailwind.config.js
export const CHART_THEME = {
  primary: "#13ec80", // Doanh thu, dữ liệu chủ đạo (Brand Primary)
  positive: "#10b981", // Tăng trưởng, check-in thành công, active membership
  negative: "#f43f5e", // Nợ đọng, hội viên quá hạn, thất bại
  secondary: "#3b82f6", // Gói tập, phân loại dịch vụ (Blue)
  tertiary: "#8b5cf6", // PT, hoa hồng (Purple)
  warning: "#f59e0b", // Sắp hết hạn, cảnh báo (Amber)

  // Bảng màu phân bổ cho PieChart / DonutChart / Multi-bar
  palette: [
    "#13ec80", // Primary Neon Green
    "#3b82f6", // Blue
    "#f59e0b", // Amber
    "#8b5cf6", // Purple
    "#10b981", // Emerald
    "#f43f5e", // Rose
    "#06b6d4", // Cyan
    "#ec4899", // Pink
  ],

  // CHÚ Ý: 2 giá trị này PHẢI LUÔN ĐỒNG BỘ với subtle-light và subtle-dark trong tailwind.config.js:
  axisLabelLight: "#4b5563", // subtle-light
  axisLabelDark: "#9ca3af", // subtle-dark
};
