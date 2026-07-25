---
version: "alpha"
name: "Gym Fitness Management System"
description: >
  Hệ thống quản lý phòng gym — giao diện admin dashboard với hai chế độ sáng/tối.
  Phong cách: Sport-Tech tối giản, tươi sáng, chuyên nghiệp.
  Stack: React + TailwindCSS (Lexend font), hỗ trợ dark mode qua class strategy.

colors:
  primary:          "#13ec80"
  background-light: "#f6f8f7"
  background-dark:  "#102219"
  surface-light:    "#ffffff"
  surface-dark:     "#182c22"
  text-light:       "#0d1b14"
  text-dark:        "#e0f2e9"
  subtle-light:     "#4c9a73"
  subtle-dark:      "#7bbf9a"
  border-light:     "#cfe7db"
  border-dark:      "#2d523f"
  primary-subtle-light: "#e7f3ed"
  primary-subtle-dark:  "rgba(19, 236, 128, 0.1)"
  positive-light:   "#07882c"
  positive-dark:    "#50c878"
  negative-light:   "#e72a08"
  negative-dark:    "#ff6b6b"
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
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.background-dark}"
    fontWeight:      700
    rounded:         "{rounded.lg}"
    height:          56px
    padding:         "0 24px"

  button-primary-hover:
    backgroundColor: "rgba(19, 236, 128, 0.9)"

  button-primary-disabled:
    backgroundColor: "{colors.primary}"
    opacity:         "0.7"

  button-ghost:
    backgroundColor: "transparent"
    textColor:       "{colors.subtle-light}"
    rounded:         "{rounded.lg}"
    padding:         "8px 16px"

  button-ghost-hover:
    backgroundColor: "{colors.primary-subtle-light}"

  input:
    backgroundColor: "{colors.surface-light}"
    textColor:       "{colors.text-light}"
    rounded:         "{rounded.lg}"
    height:          56px
    padding:         "0 15px"
    borderColor:     "rgba(55, 65, 81, 0.5)"

  input-focus:
    borderColor:     "{colors.primary}"
    boxShadow:       "0 0 0 2px rgba(19, 236, 128, 0.5)"

  input-dark:
    backgroundColor: "#102219"
    textColor:       "{colors.text-dark}"

  sidebar:
    width:           256px
    widthCollapsed:  64px
    backgroundColor: "{colors.surface-light}"
    borderColor:     "{colors.border-light}"

  sidebar-dark:
    backgroundColor: "#111827"
    borderColor:     "#1f2937"

  nav-item-active:
    backgroundColor: "rgba(19, 236, 128, 0.15)"
    textColor:       "{colors.text-light}"
    fontWeight:      700
    rounded:         "{rounded.lg}"

  nav-item-active-indicator:
    width:           4px
    height:          24px
    backgroundColor: "{colors.primary}"
    rounded:         "{rounded.sm}"

  nav-item-hover:
    backgroundColor: "#f3f4f6"

  nav-item-hover-dark:
    backgroundColor: "rgba(255, 255, 255, 0.05)"

  card:
    backgroundColor: "{colors.surface-light}"
    rounded:         "{rounded.xl}"
    padding:         "{spacing.lg}"
    borderColor:     "{colors.border-light}"
    boxShadow:       "0 1px 3px rgba(0,0,0,0.06)"

  card-dark:
    backgroundColor: "{colors.surface-dark}"
    borderColor:     "{colors.border-dark}"

  badge-positive:
    backgroundColor: "{colors.primary-subtle-light}"
    textColor:       "{colors.positive-light}"
    rounded:         "{rounded.full}"
    padding:         "2px 10px"

  badge-negative:
    backgroundColor: "#fef2f2"
    textColor:       "{colors.negative-light}"
    rounded:         "{rounded.full}"
    padding:         "2px 10px"

  modal:
    backgroundColor: "{colors.surface-light}"
    rounded:         "{rounded.xl}"
    padding:         "{spacing.xl}"
    boxShadow:       "0 20px 60px rgba(0,0,0,0.15)"

  tooltip:
    backgroundColor: "#111827"
    textColor:       "#ffffff"
    rounded:         "{rounded.md}"
    padding:         "6px 10px"

  scrollbar:
    width:           4px
    thumbColor:      "{colors.gray-scrollbar-light}"
    thumbColorHover: "#9ca3af"

  scrollbar-dark:
    thumbColor:      "{colors.gray-scrollbar-dark}"
    thumbColorHover: "#4b5563"
---

## Overview

**Gym Fitness Management System** là admin dashboard quản lý phòng gym, xây dựng bằng React + TailwindCSS. Giao diện được thiết kế theo phong cách **Sport-Tech tối giản** — kết hợp giữa năng lượng vận động (màu xanh lá neon) và sự chuyên nghiệp của phần mềm doanh nghiệp.

## Colors

Palette xoay quanh một màu accent neon xanh lá duy nhất trên nền tối/sáng trung tính.

- **primary (`#13ec80`)**: Màu xanh lá neon — dùng cho CTA, active states, icon logo, border focus. Đây là màu nhận diện thương hiệu duy nhất.
- **background-light (`#f6f8f7`)**: Nền trang ở light mode — trắng xanh nhẹ, không gây mỏi mắt.
- **background-dark (`#102219`)**: Nền trang ở dark mode — xanh rừng đậm, tạo chiều sâu.
- **surface-light (`#ffffff`)**: Nền card/panel ở light mode.
- **surface-dark (`#182c22`)**: Nền card/panel ở dark mode.
- **text-light (`#0d1b14`)**: Màu chữ chính ở light mode — gần đen, tông xanh lá rất nhẹ.
- **text-dark (`#e0f2e9`)**: Màu chữ chính ở dark mode — trắng xanh nhẹ.
- **subtle-light / subtle-dark**: Màu chữ phụ (meta, label, description).
- **border-light (`#cfe7db`) / border-dark (`#2d523f`)**: Viền card, input, separator.
- **positive (`#07882c` / `#50c878`)**: Trạng thái tích cực — tăng trưởng, thành công, active membership.
- **negative (`#e72a08` / `#ff6b6b`)**: Trạng thái tiêu cực — giảm, lỗi, hết hạn.

> **Nguyên tắc**: Không dùng màu nào ngoài palette này. Primary accent chỉ xuất hiện ở các điểm tương tác chủ đạo; không dùng làm nền toàn trang.

## Typography

Font duy nhất: **Lexend** (Google Fonts) — thiết kế để đọc nhanh, phù hợp với dashboard số liệu.

- **display / h1**: Dùng cho tiêu đề trang (Login, Dashboard section), `font-black` / `font-extrabold`, tracking âm.
- **h2, h3**: Tiêu đề card, section, modal.
- **body-md**: Nội dung chính, mô tả.
- **label-caps (`11px, bold`)**: Label nhóm sidebar ("Chính", "Quản lý", "Phân tích") — dùng `text-gray-400` để không cạnh tranh với nav items.
- **caption**: Metadata nhỏ, footer credit, timestamp.

> Font weight tối thiểu cho interactive elements là `font-medium (500)`. Không dùng `font-light` hoặc `font-thin` trong UI này.

## Layout

Kiến trúc layout **sidebar + main content**:

- **Sidebar**: Fixed left, `w-64` (expanded) / `w-16` (collapsed), transition 300ms. Có toggle button (`±right-3, rounded-full`).
- **Main**: `ml-64` hoặc `ml-16` tương ứng. Padding nội dung `p-6` hoặc `p-8`.
- **Header**: Fixed top, `h-16`, nằm trong vùng main (không che sidebar).
- **Breakpoint**: Layout được tối ưu cho màn hình `lg:` (>=1024px) trở lên — đây là admin tool, không ưu tiên mobile.

## Components

### Button

- **Primary**: Nền `primary`, chữ `background-dark` (dark green), `font-bold`, `h-14 (56px)`, `rounded-lg`. Trạng thái hover dùng `primary/90`.
- **Ghost**: Nền transparent, hover `primary-subtle-light`, dùng cho actions phụ.
- Disabled: opacity 70%, giữ nguyên màu nền (không dùng gray).

### Input

- Height `h-14 (56px)`, `rounded-lg`, border `border-gray-700/50`.
- Focus: `ring-2 ring-primary/50` + `border-primary`.
- Pattern: Input kết hợp icon bên phải trong div wrapper (`rounded-r-none` + div `rounded-r-lg border-l-0`).

### Sidebar Nav Item

- Active: `bg-primary/15`, chữ `gray-900`/`gray-100`, `font-bold`, kèm thanh indicator `w-1 h-6 bg-primary rounded-r-full` ở cạnh trái.
- Hover: `bg-gray-100` (light) / `bg-white/5` (dark).
- Collapsed: Hiện tooltip ở `left-full` khi hover.

### Cards / Panels

- `bg-white dark:bg-surface-dark`, `rounded-xl`, border `border-light`/`border-dark`, shadow nhẹ.
- Padding trong card: `p-6` (standard) hoặc `p-4` (compact).

### Scrollbar

- Width 4px, thumb `#d1d5db` (light) / `#374151` (dark), `border-radius: 99px`.
- Apply class `custom-scrollbar` — đã định nghĩa trong `index.css`.

## Dark Mode

Dark mode toggle qua class `dark` trên `<html>`. Mọi component dùng cặp class `bg-X dark:bg-Y`.

Quy ước đặt tên dark variant:
- Background: `bg-white` -> `dark:bg-gray-900` (sidebar) hoặc `dark:bg-surface-dark` (card)
- Text: `text-gray-900` -> `dark:text-gray-100`
- Border: `border-gray-200` -> `dark:border-gray-800`

> Không hardcode màu hex trực tiếp trong JSX. Luôn dùng Tailwind class hoặc biến Tailwind đã định nghĩa trong `tailwind.config.js`.

## Animations & Transitions

- **Dropdown**: `slideDown` keyframe — `opacity 0->1`, `translateY -6px->0`, `0.18s ease-out`.
- **Sidebar collapse**: `transition-all duration-300 ease-in-out`.
- **Hover states**: `transition-colors duration-200`.
- **Loading shrink** (notification bar): `shrink 10s linear forwards` — `scaleX(1->0)`.

> Giữ animation ngắn (150–300ms). Không dùng animation rườm rà cho data tables hoặc các thao tác CRUD.

## Iconography

Thư viện icon: **Lucide React** (`lucide-react`). Kích thước chuẩn `size={20}` cho sidebar nav, `size={16}` cho inline icons trong text.

Màu icon:
- Active: `text-gray-900 dark:text-gray-100`
- Inactive: `text-gray-400 dark:text-gray-500`
- Brand (logo): `text-primary`

## Voice & Tone

- Ngôn ngữ giao diện: **Tiếng Việt** (label, placeholder, thông báo)
- Tên app: **"Gym Fitness"** (hiển thị sidebar), tên đầy đủ: **"Hệ thống Quản lý Phòng Gym"**
- Tone: Chuyên nghiệp, rõ ràng, không dùng tiếng lóng. Thông báo lỗi cụ thể, không generic.
