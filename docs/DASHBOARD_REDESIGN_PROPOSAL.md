# Đề xuất tái thiết kế Dashboard theo vai trò

## 1. Kết luận thiết kế

Dashboard mới nên được xây như một **workspace theo vai trò**, không phải một trang báo cáo gồm nhiều card giống nhau.

- Nhân viên nhìn thấy việc cần xử lý ngay, lịch trong ngày và chỉ số cá nhân.
- Quản lý nhìn thấy ngoại lệ, tình trạng đội nhóm và các quyết định cần đưa ra.
- Kế toán nhìn thấy đối soát, dòng tiền và các khoản chờ xử lý.
- Admin nhìn thấy sức khỏe hệ thống, chi nhánh và các cảnh báo quản trị.

Hướng thị giác đề xuất: **Operational Editorial / Training Logbook** — một bảng điều hành phòng gym có nhịp điệu như sổ huấn luyện, dùng lưới rõ, chữ mạnh, đường kẻ mảnh và các mảng dữ liệu có kích thước khác nhau. Đây không phải kiểu “AI dashboard” với hàng loạt card bo tròn, gradient tím/xanh, icon phát sáng và câu chữ chung chung.

## 2. Vấn đề của dashboard hiện tại

Qua `frontend/src/pages/Dashboard.jsx` và `backend/controllers/dashboardController.js`:

1. Mở đầu của cả ba nhánh PT, Sale và Operations đều là bốn stat card ngang có trọng lượng gần như nhau.
2. “Ghi chú ca trực” đang là một stat card mở modal, trong khi đây là nội dung hành động quan trọng nhất với OP/Sale/PT.
3. `sm`, `pm`, `om`, `manager`, `admin`, `accountant` đều có thể rơi vào cùng dashboard toàn chi nhánh vì logic hiện tại ưu tiên `report.read_all`. Do đó các cấp quản lý chưa có góc nhìn đúng phòng ban.
4. Accountant và Admin vẫn nhận dữ liệu task dù nhu cầu chính của hai role này không phải vận hành ca trực.
5. Màu xanh, tím, cam được dùng để trang trí từng KPI. Cách này làm giảm ý nghĩa của màu cảnh báo.
6. Các card cùng kích thước tạo cảm giác template SaaS phổ biến; chưa thể hiện đặc trưng phòng gym hoặc nhịp làm việc tại quầy.
7. Biểu đồ giờ check-in chiếm diện tích lớn ngay cả khi không có dữ liệu; nội dung quan trọng bị đẩy xuống dưới.

## 3. Khung trang chung

### Desktop — 12 cột

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Lời chào + ngày/ca + chi nhánh            Tìm kiếm     Hành động nhanh│
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │ CÔNG VIỆC HÔM NAY     │
│  TIÊU ĐIỂM THEO ROLE                          │ 09:00  Gọi lại...     │
│  KPI chính / trạng thái ca / cảnh báo         │ 10:30  Xác nhận...    │
│                                               │ [Xem tất cả] [+]      │
├───────────────────────────────┬───────────────┴──────────────────────┤
│ DÒNG CÔNG VIỆC / LỊCH HÔM NAY │ NGOẠI LỆ / CẦN CHÚ Ý               │
│ danh sách có thể thao tác      │ chỉ hiện khi cần hành động          │
├───────────────────────────────┴──────────────────────────────────────┤
│ XU HƯỚNG / HIỆU SUẤT — tối đa 1–2 biểu đồ đơn giản                 │
└──────────────────────────────────────────────────────────────────────┘
```

Nguyên tắc: khối ở góc trên trái trả lời “tình hình chính là gì?”, cột bên phải trả lời “tôi cần làm gì tiếp theo?”. Nội dung chi tiết được mở tại drawer hoặc trang nghiệp vụ, không dồn vào dashboard.

### Tablet và mobile

Thứ tự xếp dọc bắt buộc:

1. Cảnh báo khẩn / trạng thái ca.
2. Công việc hôm nay.
3. Hành động nhanh.
4. KPI chính.
5. Lịch hoặc dòng công việc.
6. Biểu đồ và hoạt động gần đây.

Không thu nhỏ nguyên dashboard desktop. Biểu đồ giờ chuyển thành danh sách “3 khung giờ đông nhất”; bảng chuyển thành các row có nhãn rõ.

## 4. Card “Công việc hôm nay” dùng chung

### Role được hiển thị

| Role | Hiển thị | Phạm vi |
|---|---:|---|
| `reception` / OP | Có | Đội reception |
| `sale` | Có | Đội sale |
| `pt` | Có | Đội PT |
| `om` | Có | Reception + tổng hợp đội vận hành |
| `sm` | Có | Sale + tổng hợp đội sale |
| `pm` | Có | PT + tổng hợp đội PT |
| `manager` | Có | Tất cả đội, có bộ lọc |
| `accountant` | Không | Thay bằng “Đối soát cần xử lý” |
| `admin` | Không | Thay bằng “Cảnh báo hệ thống” |

### Hành vi đề xuất

- Card luôn nằm trong viewport đầu tiên, rộng 4/12 cột ở desktop.
- Hiển thị tối đa 4 việc, ưu tiên `quá hạn → trong 60 phút → còn lại`.
- Mỗi dòng có giờ, nội dung, người/đội phụ trách và checkbox hoàn thành.
- Quá hạn dùng vạch đỏ ở mép trái; sắp tới dùng amber; bình thường trung tính.
- Không dùng `animate-pulse` liên tục. Chỉ rung/nháy một lần khi task vừa chuyển trạng thái khẩn.
- “Xem tất cả” mở drawer bên phải thay cho modal giữa màn hình để giữ ngữ cảnh dashboard.
- Manager có tab `Tất cả / Sale / PT / OP`; nhân viên không thấy tab ngoài đội mình.
- Khi hết việc, card vẫn giữ chỗ nhưng chuyển thành trạng thái gọn: “Đã xong 8/8” và đề xuất hành động tiếp theo.

## 5. Bố cục cho từng role

### Reception / OP

Mục tiêu: vận hành ca nhanh, giảm thời gian tìm chức năng.

- **Tiêu điểm:** trạng thái ca hiện tại, số người đang trong phòng, lượt check-in gần nhất.
- **Công việc hôm nay:** checklist ca trực cố định bên phải.
- **Hành động nhanh:** Check-in, tạo hội viên, bán hàng, ghi nhận buổi PT.
- **Dòng công việc:** activity stream check-in/check-out theo thời gian thực.
- **Ngoại lệ:** khuôn mặt không nhận diện, hợp đồng hết hạn, đơn chưa thanh toán, tồn kho thấp.
- **Xu hướng:** heat strip 6h–22h; không cần biểu đồ lớn khi dữ liệu bằng 0.

### Sale

Mục tiêu: biết lead nào phải liên hệ và khoảng cách tới target.

- **Tiêu điểm:** doanh số tháng + khoảng còn thiếu + pace dự kiến cuối tháng.
- **Công việc hôm nay:** follow-up lead, gọi gia hạn, hẹn tư vấn.
- **Pipeline hành động:** `Lead mới → Đã liên hệ → Hẹn tư vấn → Chốt`, hiển thị số lượng và lead đang kẹt.
- **Danh sách ưu tiên:** 5 lead có khả năng/chỉ báo cần gọi lại cao nhất dựa trên quy tắc nghiệp vụ, không gắn nhãn “AI”.
- **KPI phụ:** hợp đồng mới, gia hạn, tỉ lệ chuyển đổi; gom trong một dải số liệu, không tách thành ba card màu.
- **Hoạt động gần đây:** hợp đồng vừa chốt và lead vừa đổi trạng thái.

### PT

Mục tiêu: điều phối lịch dạy và theo sát khách.

- **Tiêu điểm:** buổi dạy kế tiếp, khách, giờ và trạng thái xác nhận.
- **Công việc hôm nay:** checklist đội PT.
- **Timeline:** lịch dạy theo giờ; trạng thái `đã xác nhận / chờ / hoàn thành / vắng`.
- **Khách cần chú ý:** sắp hết buổi, lâu chưa quay lại, chưa có lịch tiếp theo.
- **KPI:** số buổi tháng, tỉ lệ hoàn thành, giữ chân; thể hiện bằng một progress rail duy nhất.
- **Hành động nhanh:** ghi nhận buổi tập, xem hồ sơ khách, tạo lịch hẹn.

### Sales Manager (`sm`)

Mục tiêu: điều hành pipeline và tháo điểm nghẽn cho đội sale.

- **Tiêu điểm:** doanh số đội so với target và pace cần đạt mỗi ngày còn lại.
- **Công việc hôm nay:** task đội sale, có người phụ trách và trạng thái quá hạn.
- **Pipeline đội:** funnel ngắn 4 giai đoạn, kèm biến động so với tuần trước.
- **Ngoại lệ:** sale không có hoạt động, lead quá SLA, hợp đồng chờ duyệt.
- **Bảng đội:** mỗi sale một row gồm doanh số, conversion, follow-up quá hạn; mặc định sắp theo “cần hỗ trợ”, không phải top doanh số.

### PT Manager (`pm`)

Mục tiêu: cân tải PT và bảo đảm chất lượng phục vụ.

- **Tiêu điểm:** số buổi hôm nay, tỷ lệ lấp lịch và số ca chưa có PT.
- **Công việc hôm nay:** task đội PT.
- **Lịch đội:** timeline theo PT để nhìn trùng lịch và khoảng trống.
- **Ngoại lệ:** khách sắp hết buổi, PT quá tải, buổi bị dispute, khách vắng nhiều.
- **Bảng đội:** số buổi, công suất, retention và cảnh báo; tránh leaderboard công khai mặc định.

### Operations Manager (`om`)

Mục tiêu: theo dõi hoạt động sàn/quầy theo ca.

- **Tiêu điểm:** trạng thái cơ sở hiện tại: số người trong phòng, check-in/giờ, trạng thái quầy.
- **Công việc hôm nay:** task reception/operations.
- **Nhịp vận hành:** heat strip giờ đông và staffing tương ứng.
- **Ngoại lệ:** lỗi nhận diện, thiết bị/cơ sở vật chất, tồn kho thấp, giao dịch treo.
- **Bàn giao ca:** log ngắn có người tạo, thời gian và mức độ ưu tiên.

### Branch Manager (`manager`)

Mục tiêu: nhìn sức khỏe chi nhánh và quyết định nơi cần can thiệp.

- **Tiêu điểm:** “Branch pulse” gồm doanh thu, check-in, conversion và utilization trên một dải.
- **Công việc hôm nay:** task cả ba đội với bộ lọc.
- **Ngoại lệ:** 5 vấn đề cần quyết định, có CTA đi thẳng tới màn nghiệp vụ.
- **Đội nhóm:** ba lane Sale / PT / OP, mỗi lane chỉ có 2–3 KPI và trạng thái.
- **Xu hướng:** doanh thu 30 ngày và check-in 7 ngày; không trộn quá hai câu chuyện vào một chart.

### Accountant

Mục tiêu: đối soát và kiểm soát dòng tiền. Không hiển thị card công việc ca trực.

- **Tiêu điểm:** tiền thực thu hôm nay, chênh lệch đối soát, khoản chờ xác nhận.
- **Đối soát cần xử lý:** giao dịch treo, hoàn tiền/hủy, kỳ hoa hồng chờ duyệt.
- **Dòng tiền:** doanh thu theo nguồn và phương thức thanh toán.
- **Đóng sổ:** trạng thái kỳ hiện tại, checklist nghiệp vụ riêng của kế toán nếu phát triển sau.
- **Ngoại lệ:** số liệu lệch, giao dịch không map hóa đơn, kỳ hoa hồng bất thường.

### Admin

Mục tiêu: quản trị hệ thống và nhiều chi nhánh. Không hiển thị card công việc ca trực.

- **Tiêu điểm:** sức khỏe hệ thống, số chi nhánh đang hoạt động, lỗi tích hợp.
- **Cảnh báo hệ thống:** dịch vụ nhận diện, database/backup, cấu hình thiếu, lỗi đồng bộ.
- **So sánh chi nhánh:** bảng compact, chỉ các KPI cấp cao và trạng thái bất thường.
- **Hoạt động quản trị:** thay đổi quyền, cấu hình, audit quan trọng.
- **Hành động nhanh:** chuyển chi nhánh, quản lý quyền, xem audit, kiểm tra backup.

### `staff` legacy

Không nên tạo dashboard riêng lâu dài. Cần map role này sang OP/reception hoặc một permission profile rõ ràng; nếu vẫn giữ, dùng dashboard tối giản gồm hành động nhanh, hoạt động cá nhân và không hiển thị dữ liệu tài chính.

## 6. Ngôn ngữ thị giác tránh “AI đại trà”

### Nên dùng

- Nền “chalk/off-white” thay vì trắng lạnh: `#F4F3EE`; dark mode: `#141613`.
- Surface gần nền, phân khu bằng khoảng cách và đường kẻ thay vì mọi thứ đều thành card nổi.
- Màu brand `#13EC80` giữ cho trạng thái active và CTA chính, nhưng giảm diện tích sử dụng.
- Màu semantic: đỏ = phải xử lý, amber = sắp đến hạn, xanh = hoàn tất. Không tô màu riêng cho từng KPI.
- Tiêu đề ngắn, condensed hoặc semi-condensed để gợi biển chỉ dẫn trong gym; body dùng Lexend hiện có hoặc chuyển sang `IBM Plex Sans`/`Manrope` sau khi thử nghiệm tiếng Việt.
- Số liệu dùng tabular numerals để các cột thẳng hàng.
- Góc card 8–12px, không bo 16–24px tràn lan.
- Ảnh/chất liệu gym chỉ xuất hiện có chủ đích ở empty state hoặc onboarding, không làm background dashboard.

### Tránh dùng

- Gradient tím/xanh, glow, glassmorphism và orb mờ.
- Mỗi card một màu pastel và icon trong ô vuông bo tròn.
- 8–12 card đồng kích thước kiểu bento template.
- Emoji ăn mừng, câu động viên chung chung, nhãn “AI insight”.
- Chart donut cho mọi tỷ lệ; gauge dạng đồng hồ; animation chạy liên tục.
- Shadow đậm. Dùng border và phân cấp typography làm cấu trúc chính.

## 7. Hệ thống component đề xuất

```text
RoleDashboardShell
├── ShiftContextBar
├── PrimaryFocus
├── TodayTasksPanel
├── QuickActions
├── ExceptionQueue
├── WorkflowTimeline / Pipeline / TeamLanes
├── MetricStrip
└── TrendPanel
```

`RoleDashboardShell` nhận `role`, `permissions`, `activeBranch` và cấu hình module. Không tiếp tục viết nhiều `if (isPT) return ...` trong một file lớn. Component dùng chung dữ liệu và interaction, còn cấu hình role quyết định thứ tự, độ rộng và nhãn.

Backend nên trả thêm một trường view rõ ràng, ví dụ:

```json
{
  "dashboardView": "sales_manager",
  "modules": {
    "tasks": {},
    "focus": {},
    "exceptions": [],
    "metrics": []
  }
}
```

Không nên suy ra dashboard chỉ từ `report.read_all`, vì `sm`, `pm`, `om`, manager, accountant và admin đều có permission này nhưng nhu cầu khác nhau.

## 8. Dữ liệu cần bổ sung

### Có thể triển khai ngay bằng dữ liệu hiện tại

- Task theo team.
- Check-in hôm nay và giờ cao điểm.
- Doanh thu, hợp đồng mới/gia hạn.
- Buổi PT, khách đang phụ trách, retention.
- Hoạt động gần đây.

### Cần endpoint/aggregation mới

- Sale pipeline theo trạng thái và SLA follow-up.
- Lịch PT trong ngày và xung đột/công suất.
- Exception queue thống nhất cho lỗi nhận diện, thanh toán treo, tồn kho, hợp đồng hết hạn.
- Accountant reconciliation summary.
- Admin health/multi-branch summary.
- Pace dự báo cuối tháng theo tốc độ hiện tại (công thức quy tắc, không cần AI).

## 9. Lộ trình triển khai

### Phase 1 — Nền tảng và role split

1. Tách `Dashboard.jsx` thành shell + module.
2. Sửa `resolveDashboardView` theo role cụ thể.
3. Đưa Today Tasks thành panel cố định cho OP/Sale/PT và manager tương ứng.
4. Loại task khỏi Accountant/Admin.
5. Tạo Metric Strip và Exception Queue dùng chung.

### Phase 2 — Ba dashboard tuyến đầu

1. Reception/OP.
2. Sale.
3. PT.
4. Kiểm thử trên laptop 1366×768 và mobile.

### Phase 3 — Dashboard quản lý

1. SM, PM, OM.
2. Branch Manager.
3. Accountant.
4. Admin/multi-branch.

### Phase 4 — Tinh chỉnh

- Đo thời gian hoàn thành tác vụ chính.
- Theo dõi module nào được mở và CTA nào được dùng.
- Phỏng vấn nhanh từng role sau 1–2 tuần dùng thật.
- Chỉ thêm tùy biến/drag-drop nếu có nhu cầu lặp lại rõ ràng.

## 10. Cơ sở tham khảo

- [Tableau Visual Best Practices](https://help.tableau.com/current/blueprint/en-us/bp_visual_best_practices.htm): đặt nội dung quan trọng ở trên/trái, dùng khoảng trắng, kích thước và màu có chủ đích.
- [Tableau — Best practices for effective dashboards](https://www.tableau.com/blog/best-practices-for-building-effective-dashboards): thiết kế theo audience, giới hạn số view và màu, ưu tiên tốc độ tải.
- [U.S. Web Design System — Data visualizations](https://designsystem.digital.gov/components/data-visualizations/): biểu đồ đơn giản, một ý chính, có tóm tắt bằng chữ và không phụ thuộc hover.
- [Carbon Design System — Data visualization](https://www.carbondesignsystem.com/building-blocks/data-visualization/overview): ưu tiên biểu đồ rõ, chính xác và accessible.
- [Tableau Research — Dashboard Census](https://www.tableau.com/blog/tableau-research-understanding-dashboard-design-at-scale): nghiên cứu quy mô lớn cho thấy vai trò quan trọng của text và các biểu đồ đơn giản trong dashboard thực tế.

## 11. Quyết định khuyến nghị

Nếu chỉ chọn một phương án để triển khai, chọn **Operational Editorial** với cấu trúc `Primary Focus + Today Tasks + Exception Queue`, bắt đầu từ Reception/OP, Sale và PT. Đây là thay đổi tạo khác biệt rõ nhất về trải nghiệm, tận dụng được dữ liệu hiện có và không phụ thuộc vào hiệu ứng thị giác theo xu hướng.

## 12. Hiệu chỉnh sau khi kiểm tra nội dung

Dashboard không nên lặp lại cùng một luồng dữ liệu dưới hai cách trình bày. Với role vận hành, `Tình hình check-in` đã là khối theo dõi chính, vì vậy danh sách `Hoạt động gần đây` được thay bằng `Hội viên mới`. Nút `Check-in nhanh` cũng được bỏ khỏi dashboard vì đây là nghiệp vụ riêng đã có điểm truy cập trong điều hướng.

Ba kiểu bố cục được áp dụng:

- **Vận hành:** check-in hiện tại, công việc trong ca, hội viên mới, các mục cần chú ý.
- **Cá nhân theo role (Sale/PT):** kết quả, hoạt động nghiệp vụ, công việc, tiến độ chỉ tiêu và khoảng cách cần xử lý.
- **Quản trị/tài chính:** chỉ số tổng hợp, ngoại lệ cần kiểm tra và tiến độ; không hiển thị công việc theo ca.

Mọi KPI và panel đều phải có drill-down rõ ràng. Thẻ doanh thu chỉ xuất hiện khi API trả về dữ liệu doanh thu; role không có quyền sẽ thấy một chỉ số vận hành hữu ích thay vì thông báo kỹ thuật về quyền.
