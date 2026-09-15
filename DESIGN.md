---
version: "beta"
name: "Gym Fitness Management System"
description: >
  Hệ thống quản lý phòng gym — giao diện admin dashboard với hai chế độ sáng/tối.
  Phong cách: Sport-Tech tối giản, tươi sáng, chuyên nghiệp.
  Stack: React + TailwindCSS (Lexend font), hỗ trợ dark mode qua class strategy.

colors:
  primary:              "#13ec80"
  background-light:     "#f6f8f7"
  background-dark:      "#121316"
  surface-light:        "#ffffff"
  surface-dark:         "#1e1f26"
  text-light:           "#0d1b14"
  text-dark:            "#f3f4f6"
  subtle-light:         "#4c9a73"
  subtle-dark:          "#9ca3af"
  border-light:         "#e5e7eb"
  border-dark:          "#2d2f36"
  primary-subtle-light: "#e7f3ed"
  primary-subtle-dark:  "rgba(19, 236, 128, 0.1)"
  positive-light:       "#07882c"
  positive-dark:        "#10b981"
  negative-light:       "#e72a08"
  negative-dark:        "#f43f5e"
  gray-scrollbar-light: "#d1d5db"
  gray-scrollbar-dark:  "#374151"

typography:
  display:
    fontFamily: Lexend
    fontSize: 2.25rem
    fontWeight: 900
    letterSpacing: -0.033em
    lineHeight: 1.1
  h1:
    fontFamily: Lexend
    fontSize: 1.875rem
    fontWeight: 800
    letterSpacing: -0.02em
  h2:
    fontFamily: Lexend
    fontSize: 1.5rem
    fontWeight: 700
  h3:
    fontFamily: Lexend
    fontSize: 1.125rem
    fontWeight: 700
  body-md:
    fontFamily: Lexend
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Lexend
    fontSize: 0.875rem
    fontWeight: 500
  label:
    fontFamily: Lexend
    fontSize: 0.875rem
    fontWeight: 500
  label-caps:
    fontFamily: Lexend
    fontSize: 0.6875rem
    fontWeight: 700
    letterSpacing: 0.02em
  caption:
    fontFamily: Lexend
    fontSize: 0.75rem
    fontWeight: 400

rounded:
  none: 0px
  sm:   6px
  md:   8px
  lg:   12px
  xl:   16px
  full: 9999px

spacing:
  xs:  4px
  sm:  8px
  md:  16px
  lg:  24px
  xl:  32px
  2xl: 48px

components:
  card:
    backgroundColor: "{colors.surface-light}"
    rounded:         "{rounded.xl}"
    borderColor:     "{colors.border-light}"
    boxShadow:       "0 1px 3px rgba(0,0,0,0.06)"

  card-dark:
    backgroundColor: "{colors.surface-dark}"
    borderColor:     "{colors.border-dark}"

  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.background-dark}"
    fontWeight:      700
    rounded:         "{rounded.lg}"
    height:          48px
    padding:         "0 20px"

  button-ghost:
    backgroundColor: "transparent"
    textColor:       "{colors.subtle-light}"
    rounded:         "{rounded.lg}"
    padding:         "8px 16px"

  input:
    backgroundColor: "{colors.surface-light}"
    textColor:       "{colors.text-light}"
    rounded:         "{rounded.lg}"
    height:          44px
    padding:         "0 14px"
    borderColor:     "{colors.border-light}"

  input-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor:       "{colors.text-dark}"
    borderColor:     "{colors.border-dark}"
---

# Gym Fitness Management System — Bộ Quy Chuẩn Thiết Kế (DESIGN.md)

Tài liệu này là **nguồn chân lý duy nhất (Single Source of Truth)** cho toàn bộ giao diện của dự án. Mọi component và trang phải tuân thủ nghiêm ngặt các quy chuẩn dưới đây. Tuyệt đối không hardcode mã màu hoặc kích thước tuỳ tiện.

---

## 1. Bảng Màu Chuẩn (Color Tokens)

Đồng bộ 100% với `frontend/tailwind.config.js`:

| Token Name | Light Mode | Dark Mode | Ý nghĩa & Vị trí sử dụng |
| :--- | :--- | :--- | :--- |
| `primary` | `#13ec80` | `#13ec80` | Xanh lá neon brand: CTA chính, active state, logo |
| `background-*` | `#f6f8f7` | `#121316` | Nền toàn trang |
| `surface-*` | `#ffffff` | `#1e1f26` | Nền card, container, bảng, modal, dropdown |
| `text-*` | `#0d1b14` | `#f3f4f6` | Màu chữ chính (tiêu đề, số liệu, dữ liệu chính) |
| `subtle-*` | `#4c9a73` | `#9ca3af` | Màu chữ phụ, label, meta, icon không active |
| `border-*` | `#e5e7eb` | `#2d2f36` | Đường viền card, đường kẻ bảng, divider, grid |
| `positive-*` | `#07882c` | `#10b981` | Thành công, tăng trưởng, hoạt động (active) |
| `negative-*` | `#e72a08` | `#f43f5e` | Thất bại, giảm, nợ đọng, hết hạn |

> **Nguyên tắc**: Luôn sử dụng class Tailwind dạng cặp token:  
> `bg-surface-light dark:bg-surface-dark`, `text-text-light dark:text-text-dark`, `border-border-light dark:border-border-dark`.  
> Cấm hardcode `text-gray-*`, `text-black`, `text-white` hoặc `bg-gray-800/900` cho nền card.

---

## 2. Thang Chữ Chuẩn (Typography Scale)

Toàn bộ hệ thống sử dụng font **Lexend** (Google Fonts).

| Cấp độ | Kích thước & Weight | Tailwind Class | Màu áp dụng | Ngữ cảnh sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | 24px - 30px / Bold (700-800) | `text-2xl font-bold` (hoặc `md:text-3xl`) | `text-text-light dark:text-text-dark` | Tiêu đề chính đầu trang |
| **Section Title** | 18px / SemiBold (600) | `text-lg font-semibold` | `text-text-light dark:text-text-dark` | Tiêu đề Card, Header bảng, Tiêu đề Modal |
| **Field Label / Subhead** | 14px / Medium (500) | `text-sm font-medium` | `text-subtle-light dark:text-subtle-dark` | Nhãn ô input, header cột bảng, subtitle |
| **Body Text** | 14px / Regular (400) | `text-sm font-normal` | `text-text-light dark:text-text-dark` | Dữ liệu bảng, nội dung thông thường |
| **Caption / Meta** | 12px / Regular (400) | `text-xs font-normal` | `text-subtle-light dark:text-subtle-dark` | Timestamp, mã ID, ghi chú nhỏ |

---

## 3. Quy Chuẩn Khung Card & Bo Góc

### 3.1. Khung Card Chuẩn (Container Pattern)
Mọi card thông tin, bộ lọc (filter bar), bảng danh sách, modal đều phải dùng chung công thức:
```jsx
<div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-sm p-4 md:p-6">
  {/* Nội dung */}
</div>
```

### 3.2. Quy Chuẩn Bo Góc (Border Radius Hierarchy)
- `rounded-xl` (16px): Khung Card lớn, Container bảng, Khung bộ lọc, Hộp thoại Modal.
- `rounded-lg` (12px): Các phần tử tương tác (Button, Ô Input, Select, Menu Dropdown).
- `rounded-full` (9999px): Badge trạng thái, Pill tag, Avatar, Toggle switch.
- **Tuyệt đối không dùng `rounded-2xl`** lẫn lộn trong các trang quản lý.

---

## 4. Quy Chuẩn Biểu Đồ (Recharts Color & Dark Mode Standard)

### 4.1. Bảng màu biểu đồ (`CHART_THEME`)
Hằng số màu dùng chung cho mọi biểu đồ trong `frontend/src/utils/theme.js` hoặc trực tiếp trong các component biểu đồ:

```javascript
export const CHART_THEME = {
  primary:   "#13ec80", // Doanh thu, dữ liệu chủ đạo (Brand Primary)
  positive:  "#10b981", // Tăng trưởng, check-in thành công, active membership
  negative:  "#f43f5e", // Nợ đọng, hội viên quá hạn, thất bại
  secondary: "#3b82f6", // Gói tập, phân loại dịch vụ (Blue)
  tertiary:  "#8b5cf6", // PT, hoa hồng (Purple)
  warning:   "#f59e0b", // Sắp hết hạn, cảnh báo (Amber)

  // CHÚ Ý: 2 giá trị này PHẢI LUÔN ĐỒNG BỘ với `subtle-light` và `subtle-dark` trong tailwind.config.js:
  axisLabelLight: "#4c9a73", // subtle-light
  axisLabelDark:  "#9ca3af", // subtle-dark
};
```

### 4.2. Xử lý Lưới (Grid) & Trục (Axis) theo Dark Mode
Không dùng `if (isDarkMode)` thủ công bằng JS cho SVG strokes. Thay vào đó, tận dụng việc Recharts chuyển tiếp `className` xuống SVG elements:

```jsx
// Đường lưới tự đổi màu theo dark mode thông qua currentColor và Tailwind classes:
<CartesianGrid
  stroke="currentColor"
  className="text-border-light dark:text-border-dark"
  strokeDasharray="3 3"
/>

// Tooltip chuẩn:
<Tooltip
  contentStyle={{
    borderRadius: "12px",
  }}
  wrapperClassName="!bg-surface-light dark:!bg-surface-dark !border-border-light dark:!border-border-dark !text-text-light dark:!text-text-dark shadow-lg"
/>
```

---

## 5. Quy Chuẩn Icon (100% Lucide React)

- **Thư viện chuẩn duy nhất**: `lucide-react` (đã có sẵn trong dự án).
- **Loại bỏ hoàn toàn**: Google Material Symbols (`<span className="material-symbols-outlined">`).
- **Kích cỡ chuẩn**:
  - `size={16}`: Inline icon trong nút nhỏ, inline badge, action buttons trong bảng.
  - `size={18}`: Icon trong ô input tìm kiếm, icon trong button thông thường.
  - `size={20}`: Icon tiêu đề mục, nav item sidebar.
  - `size={24}`: Icon tiêu đề trang chính, icon card KPI thống kê.
- **Icon dạng tô màu (Filled)**: Thêm thuộc tính `fill="currentColor"`.

---

## 6. Lộ Trình Triển Khai 3 Giai Đoạn (Migration Roadmap)

### Giai đoạn 1: Chuẩn Hóa Icon (13 files)
Chuyển đổi toàn bộ Material Symbols sang `lucide-react`, kiểm tra box-model SVG, gỡ bỏ import Google Fonts không dùng.
- `components/customer/AutoCheckIn.jsx`
- `components/customer/FaceCaptureModal.jsx`
- `components/customer/CustomerDetailModal.jsx`
- `components/staff/StaffDetailModal.jsx`
- `components/product/ProductModal.jsx`
- `components/reports/PTSessionReportModal.jsx`
- `pages/ProductList.jsx`
- `pages/Packages.jsx`
- `pages/CustomerList.jsx`
- `pages/History.jsx`
- `pages/Login.jsx`
- `pages/CheckIn.jsx`
- `pages/Staff.jsx`

### Giai đoạn 2: Chuẩn Hóa Khung Card & Typography Scale
Thay thế các class `bg-white`, `dark:bg-gray-800`, `rounded-2xl`, `text-gray-*` bằng `bg-surface-light dark:bg-surface-dark`, `border-border-light dark:border-border-dark`, `rounded-xl`, `text-text-light dark:text-text-dark`.

### Giai đoạn 3: Chuẩn Hóa Biểu Đồ Recharts
Đồng bộ bảng màu `CHART_THEME` và cấu hình `CartesianGrid` với `currentColor` trên `Reports.jsx` và các trang chứa biểu đồ.
