---
name: G-UNIFORM
description: Admin đo đồng phục cắt ra từ chính chiếc G Blazer — len navy, viền piping đỏ, nhãn dệt và nút đồng.
colors:
  navy: "#1b2b4b"
  piping: "#b8323c"
  brass: "#c9a24a"
  ink: "#16203a"
  lining: "#5b6b86"
  ground: "#fbfbfd"
  surface: "#ffffff"
  hairline: "#e3e6ec"
  input-stroke: "#c5ccda"
  secondary-fill: "#eef1f7"
  muted-fill: "#f1f3f7"
  accent-fill: "#e9edf6"
  size-first: "#c5d0e6"
  size-last: "#1b2b4b"
  unknown-ground: "#eef0f4"
  unknown-stripe: "#a9b2c3"
  sidebar-foreground: "#d5dbe8"
  success: "#2f8a5b"
  success-soft: "#e6f3ec"
  success-ink: "#1f6b43"
  warning: "#c47f00"
  warning-soft: "#fdf1d8"
  warning-ink: "#7a4b00"
  danger-soft: "#fbe9eb"
  danger-ink: "#9a2430"
  info: "#3a6fbf"
  info-soft: "#e8f0fb"
  info-ink: "#1f4e8c"
typography:
  display:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tabular-nums"
  title:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  subtitle:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tabular-nums"
  dense:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.8px"
rounded:
  stitch: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#2d3c59"
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.navy}"
  button-destructive:
    backgroundColor: "{colors.piping}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  stat-block:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
  size-label:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.brass}"
    rounded: "{rounded.stitch}"
    padding: "3px 7px"
    typography: "{typography.label}"
  size-label-unknown:
    backgroundColor: "{colors.unknown-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.stitch}"
    padding: "3px 7px"
  sidebar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sidebar-foreground}"
    rounded: "0"
    padding: "12px 22px"
    width: "220px"
  sidebar-item-active:
    backgroundColor: "rgb(255 255 255 / 0.08)"
    textColor: "{colors.surface}"
  fit-choice-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  fit-choice-rest:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
  button-meter-filled:
    backgroundColor: "{colors.brass}"
    rounded: "{rounded.full}"
    size: "26px"
  button-meter-empty:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "26px"
---

# Design System: G-UNIFORM

## Overview

**Creative North Star: "Áo vest & nhãn dệt"**

Giao diện được cắt ra từ chính chiếc G Blazer. Sidebar là thân áo len navy `#1B2B4B` viền một đường piping đỏ `#B8323C` mảnh 1px; vùng làm việc là nền vải sơ mi `#FBFBFD` với các tấm trắng viền hairline; mọi chỗ gọi tên một cỡ đều hiện ra dưới dạng nhãn dệt `CỠ N` chữ đồng trên nền navy, đường may đứt nét bên trong. Thế giới này từ chối kiểu admin SaaS xám với một accent xanh dương: màu ở đây là màu của vật liệu may mặc, không phải của bảng màu framework.

Mật độ cao và lạnh. Buổi đo diễn ra trong hội trường sáng gắt, nhân viên vừa đo vừa nhập trên điện thoại; vì vậy nền sáng, chữ ink `#16203A` tương phản mạnh, số liệu luôn `tabular-nums`, và mọi vùng chạm trong bảng dữ liệu đều giữ tối thiểu 44px trên mobile trước khi co lại trên desktop. Không có bóng đổ trang trí: độ sâu đến từ hairline, từ nền tint và từ đậm nhạt của chính dải dữ liệu.

Hai signature mang toàn bộ bản sắc: **nhãn dệt** cho cỡ và **hàng nút đồng** cho tỉ lệ. Chúng chỉ xuất hiện đúng vai của mình — nhãn khi gọi tên cỡ, nút đồng khi đọc một tỉ lệ trên thang 10 — và chính sự hiếm đó giữ cho brass `#C9A24A` không trượt thành màu trang trí.

**Key Characteristics:**
- Navy len + piping đỏ + chữ đồng, nền trắng sơ mi, không gradient trang trí.
- Phẳng tuyệt đối: hairline `#E3E6EC` thay cho shadow.
- Be Vietnam Pro duy nhất, `tabular-nums` toàn cục, không font display riêng.
- Nhãn dệt `CỠ N` là cách duy nhất để gọi tên một cỡ.
- Dải navy 7 bậc cho dữ liệu cỡ; hatch xám cho "Chưa xác định".

## Colors

Bảng màu là bảng vật liệu may đo: len navy, chỉ đỏ, khuy đồng, vải sơ mi, chỉ viền xám xanh.

### Primary
- **Len Navy** (`#1b2b4b`): thân sidebar, nút primary, đầu dải dữ liệu đậm nhất, ô heat dày nhất, trạng thái `on` của segmented control, màu `caret` và `focus ring` trên nền sáng.
- **Chữ Đồng** (`#c9a24a`): chữ của nhãn dệt, thanh 3px đánh dấu mục nav đang mở, nút đồng đã đầy, dấu check của lựa chọn fit, và `focus ring` khi đứng trên nền navy (`.on-navy`).

### Secondary
- **Chỉ Piping** (`#b8323c`): chỉ dùng làm đường viền 1px ngăn sidebar/header admin với vùng nội dung, và làm `destructive` cho hành động xóa / trạng thái lỗi. Không dùng làm nền mảng lớn, không làm viền dày một cạnh của card.

### Neutral
- **Ink** (`#16203a`): chữ chính trên nền sáng.
- **Lining** (`#5b6b86`): chữ phụ, caption, nhãn cột, scrollbar hover.
- **Ground** (`#fbfbfd`): nền trang.
- **Surface** (`#ffffff`): nền card, nền ô dính trái của bảng, nền nút đồng rỗng.
- **Hairline** (`#e3e6ec`): toàn bộ đường viền mặc định (`* { border-color }`).
- **Input Stroke** (`#c5ccda`): viền ô nhập và vòng trong của nút đồng rỗng.
- **Secondary / Muted / Accent Fill** (`#eef1f7` / `#f1f3f7` / `#e9edf6`): ba mức tint navy rất nhạt cho nền phụ, nền muted và nền hover.
- **Sidebar Foreground** (`#d5dbe8`): chữ nav ở trạng thái nghỉ; sáng lên trắng khi hover/active.

### Dải dữ liệu
- **Size Ramp** từ `#c5d0e6` (Cỡ 1) tới `#1b2b4b` (Cỡ 7): nội suy tuyến tính theo kênh RGB trong `lib/sizes.ts#sizeColor(index, count)`.
- **Hatch Chưa xác định**: nền `#eef0f4` + sọc chéo 45° `#a9b2c3` (`repeating-linear-gradient(45deg, stripe 0 2px, transparent 2px 6px)`), dùng cả cho DOM (`.hatch-unknown`) lẫn SVG (`UNKNOWN_PATTERN_FILL`).

### Trạng thái nghiệp vụ
- **Success** (`#2f8a5b`, nền `#e6f3ec`, chữ `#1f6b43`): việc đã hoàn tất, đơn đã gửi, hồ sơ đầy đủ, tiêu chí mật khẩu đã đạt.
- **Info** (`#3a6fbf`, nền `#e8f0fb`, chữ `#1f4e8c`): việc đang chạy hoặc đối tượng đang hoạt động/đang mở.
- **Warning** (`#c47f00`, nền `#fdf1d8`, chữ `#7a4b00`): cần bổ sung, vượt số lượng hoặc rủi ro cần người dùng xử lý.
- **Danger** (`#b8323c`, nền `#fbe9eb`, chữ `#9a2430`): lỗi, quá hạn, thao tác phá hủy.
- Trạng thái chưa bắt đầu, nháp, đã khóa và lựa chọn bộ lọc dùng màu trung tính hoặc navy; không gán warning chỉ vì việc chưa diễn ra.

### Named Rules
**The Size Ramp Rule.** Mọi series dữ liệu theo cỡ phải lấy màu từ `sizeColor(index, count)` — không chọn tay, không dùng bảng `chart-1…5` cho mục đích khác. Cỡ nhỏ nhạt, cỡ lớn đậm; thứ tự màu chính là thứ tự cỡ. Chữ đặt trên màu đó phải đi qua `readableOn()` / `sizeTextColor()`, không hardcode trắng hay đen.

**The Brass Scarcity Rule.** Brass chỉ xuất hiện ở ba chỗ: chữ nhãn dệt, thanh đánh dấu nav đang mở, nút đồng đã đầy (và dấu check của fit đã chọn). Brass không bao giờ là nền của một mảng lớn, không bao giờ là màu nút, không bao giờ là màu chữ trên nền sáng.

**The Piping Rule.** Đỏ `#B8323C` chỉ tồn tại dưới dạng đường mảnh: viền 1px của sidebar/header admin, hoặc viền/chữ của trạng thái lỗi và nút destructive. Không viền dày ≥2px một cạnh (trên/trái/phải) cho card bo góc, kể cả card đăng nhập.

**The State Semantics Rule.** Màu biểu thị trạng thái nghiệp vụ, không biểu thị mức quan trọng. Lựa chọn hiện tại dùng navy; đang thực hiện/đang hoạt động dùng info; hoàn tất dùng success; cần xử lý dùng warning; lỗi/quá hạn dùng danger. Badge luôn có chữ, và cảnh báo hoặc quá hạn có thêm icon để không phụ thuộc vào màu.

## Typography

**Font duy nhất:** Be Vietnam Pro (self-hosted qua `@fontsource`, latin + vietnamese, weight 400/500/600/700), fallback `ui-sans-serif, system-ui, sans-serif`.

**Character:** Một họ chữ geometric sans có bộ dấu tiếng Việt dựng riêng — đọc được ở 11px trong bảng dày đặc, và vẫn đủ cứng ở 40px khi làm con số chủ đạo. Không có font display, không có serif: thứ bậc hoàn toàn do cỡ và weight.

### Hierarchy
- **Display** (600, 40px, line-height 1): một con số duy nhất trên màn — tỉ lệ chính xác của bảng size.
- **Headline** (600, 30px, 1.1): giá trị của KPI card. Biến thể 28px cho số ở tâm donut.
- **Title** (600, 22px → 26px từ `sm`, leading-tight): tiêu đề trang trong `PageHeader`.
- **Subtitle** (600, 15px): tiêu đề của từng card (`h2`).
- **Body** (400, 14px, 1.45): mặc định toàn app, đặt ở `body`.
- **Dense** (400, 13px): bảng dữ liệu, legend, nhãn KPI, nav con, khối tài khoản trong sidebar.
- **Caption** (400, 12px): mô tả dưới tiêu đề card, chú thích "cỡ vừa suy ra".
- **Label** (600, 11px, tracking 0.8px, UPPERCASE): chữ trên nhãn dệt cỡ `sm`; tracking tăng theo scale (0.8 / 1 / 1.2px).

### Named Rules
**The Tabular Rule.** `font-variant-numeric: tabular-nums` bật ở `body` và được lặp lại tại mọi khối số (KPI, ô matrix, legend, tâm donut). Số liệu không bao giờ nhảy cột khi cập nhật.

**The One Family Rule.** Không thêm font thứ hai. Mono, serif, hay font display đều bị từ chối; `tabular-nums` đã làm xong việc của một font mono.

**The Caption Honesty Rule.** Mọi số cỡ trên dashboard là *cỡ vừa suy ra*, nên mỗi card đưa số ấy bắt buộc có một dòng caption 12px `text-muted-foreground` nói rõ điều đó.

## Layout

Shell hai phần: `aside` 220px dính trái, `h-dvh`, nền navy, `border-r border-piping` (1px), chỉ hiện từ `lg`. Dưới `lg` nó thu thành header dính cao 56px cùng nền và cùng viền piping 1px, mở sidebar trong `Sheet` rộng 260px (tối đa 85vw).

Vùng nội dung: `main` padding `16px` (`md:` 28px ngang), nội dung bọc trong container `max-w-[1280px]` canh giữa. Nhịp dọc giữa các khối cùng cấp là `16px` (`gap-4`); giữa nhóm lớn có tiêu đề riêng là `24px`; giữa field liên quan là `12px`; trong cụm nhãn–giá trị là `4px`.

Mép trái của `PageHeader`, bộ lọc, tabs, panel và bảng phải trùng nhau. Không tạo một khối hẹp lẻ (`max-w-xs`, `max-w-md`, `max-w-3xl`) bên trong trang rộng chỉ để làm form trông gọn: giới hạn chiều rộng ở cấp trang hoặc cấp ngữ cảnh. Bộ lọc nhiều trường dùng chung một grid; control đơn lẻ có thể giới hạn chiều rộng khi nội dung của nó ngắn và vẫn canh theo cùng mép trái.

Mọi grid có nội dung dài dùng `minmax(0, …)`, đặt `min-w-0` cho grid/flex item, và `items-start` khi các khối có chiều cao khác nhau. Không ép card cùng chiều cao nếu nội dung không tương đương. Nhóm hành động phải wrap hoặc xếp dọc trên mobile; badge, tên dài và ô nhập không được tạo cuộn ngang toàn trang.

Grid đã dùng:
- KPI: `grid-cols-2` → `lg:grid-cols-4`, gap 12px → 16px.
- Hàng phân tích: `xl:grid-cols-[minmax(0,1fr)_400px]` — biểu đồ phân bố co giãn, card độ chính xác cố định 400px.
- Fit choice: `grid-cols-3`, gap 8px, mỗi ô cao tối thiểu 48px.

Bảng dày đặc: `text-[13px]`, `min-w-[640px]`, cuộn ngang trong card có `-mx-5 px-5`, cột "Lớp" `sticky left-0` nền trắng; dưới `md` thêm `mask-image` tán mờ mép phải để báo còn nội dung. Ma trận dài cuộn cục bộ tối đa `32rem`, có tên vùng, nhận focus bàn phím và giữ header khi cuộn. Ô bảng có `min-h-11` (44px) trên mobile, rút về `py-1.5` từ `sm`.

Breakpoints theo mặc định Tailwind: `sm` 640, `md` 768, `lg` 1024 (điểm đổi shell), `xl` 1280.

### Trang phụ huynh (`ParentShell`, `ParentPage`)

Một shell, một mẫu trang. Dưới `md` (768) là một cột, nút cao 52px, thanh hành động dính đáy; từ `md` panel và lưới hai cột; từ `lg` (1024) header đầy đủ và bố cục desktop. Container tối đa `1120px`, padding ngang 16 / 24 / 32px.

- **Header:** thân navy (`on-navy`), viền piping 3px ở đáy, cao 56px (`lg` 64px), cùng ngôn ngữ với sidebar admin. Trái: wordmark `G-UNIFORM` / `by GIABACO · EDUCHIC` (link về danh sách khi đã đăng nhập). Phải: nút phụ trắng `Kiểm tra hồ sơ` (mở trang `Kiểm tra hồ sơ học sinh`: tìm hồ sơ đã có, chưa có thì tạo mới) (từ `md`) và menu tài khoản (avatar viết tắt tên + tên + chevron) mở dropdown phẳng có `Đăng xuất`; dưới `md` menu này chứa luôn `Thông tin học sinh` và `Kiểm tra hồ sơ`. Từ `md` có mục nav `Thông tin học sinh`, trạng thái đang mở là nền `white/8` cộng thanh brass 3px ở đáy. Đường piping là đường may của chính header navy, không còn là một vạch đỏ lẻ trên nền trắng. Trang đăng nhập, đăng ký và `/p/:token` chỉ có wordmark.
- **Footer:** nền trắng, viền hairline trên; logo Giabaco, hotline và email là liên kết `tel:` / `mailto:`. Đây là chỗ duy nhất cho hỗ trợ; không còn câu "Cần hỗ trợ?" lơ lửng cuối trang.
- **Mẫu trang con (`PageHead` → nội dung → `ActionBar`):** `PageHead` đặt tên học sinh 26 / 32px weight 600 navy, dòng `Lớp · Trường` lining, bên phải `Stepper` 3 bước (hoặc `StatusPill` ở màn tổng quan), viền hairline dưới. Nội dung là `Panel` (card hairline, tiêu đề 18px, hành động của panel đặt trong chân panel). `ActionBar` là hàng hành động duy nhất của trang: dính đáy dưới `lg`, tĩnh và canh phải từ `lg`, nút chính ngoài cùng bên phải, `Quay lại` bên trái nó.
- **Chiều rộng:** `narrow` 480 / 520 (xác nhận học sinh QR, hỗ trợ, đăng nhập, đăng ký một cột), `form` 760 (tìm hồ sơ, xác nhận hồ sơ, khai báo và sửa hồ sơ), `wide` 1120 (danh sách, số đo, chọn cỡ, xác nhận lựa chọn, tổng quan). Chiều rộng đặt trên `ParentShell`, để tiêu đề, panel và `ActionBar` cùng mép.
- **Tổng quan:** hai cột 3fr / 2fr từ `lg`: `Cỡ đã chọn` (mỗi dòng tên sản phẩm, chấm màu + tên màu, nhãn dệt cỡ; nút `Đổi lựa chọn` ở chân panel) và `Số đo` (nút `Sửa thông tin` ở chân panel). Trạng thái `Đã đăng ký` là pill success có icon check; chưa đăng ký là pill trung tính.
- **Số đo:** `Số đo` 340px bên trái, kết quả thử áo theo sản phẩm tự chia cột bên phải; dòng `Vừa` đậm navy, `Chật` / `Rộng` lining.
- **Chọn cỡ:** mỗi sản phẩm một panel: ảnh thu nhỏ bên trái (88px mobile, 128px `sm`, 160px `md`), tên sản phẩm và `Xem bảng thông số` ở trên, `ColourSelect` rồi lưới cỡ `auto-fit minmax(68px, 1fr)`. Trên thiết bị có hover, rê chuột lên ảnh hiện lens (viền navy/60, nền white/40) chạy theo con trỏ và pane phóng to bản `webp` 1600px phủ cột tuỳ chọn, cao bằng ảnh. Bấm ảnh (hoặc chạm trên di động) mở lightbox vừa khít tỉ lệ ảnh trong viewport, chỉ có nút đóng; `Esc` hoặc bấm ra ngoài để đóng.
- **Gợi ý cỡ:** khi chưa có lựa chọn đã lưu, cỡ gợi ý được chọn sẵn và mang chip `Gợi ý` (bảng cỡ, tên truy cập có thêm "theo bảng cỡ") hoặc `Thử vừa` (nhân viên đo thấy vừa) đè lên mép trên ô. Màu không bao giờ được chọn sẵn; lựa chọn cũ có `colour = null` giữ ô màu trống, và bấm `Tiếp tục` khi thiếu màu thì viền piping + `Chọn màu` hiện dưới nhóm màu.
- Không thêm câu hướng dẫn, trấn an hay mô tả phụ vào trang phụ huynh; chỉ giữ nhãn, lỗi thật và thông tin trạng thái.

## Elevation & Depth

Hệ thống **phẳng**. Không có `box-shadow` khuếch tán trong card, nút, input, select, tooltip, dialog, sheet, popover hay dropdown. Độ sâu đến từ ba cơ chế: hairline `#E3E6EC` quanh mọi bề mặt, ba bậc tint navy rất nhạt (`#E9EDF6` / `#EEF1F7` / `#F1F3F7`) cho nền phụ và hover, và độ đậm của chính dữ liệu trong ô heat. Overlay dùng nền mờ và viền để tách lớp.

Hai `box-shadow` duy nhất đều là `inset`, dùng để khắc hình khối của nút đồng chứ không để nâng vật thể lên:
- `inset 0 0 0 3px #c9a24a, inset 0 0 0 4px #8a6c22` — vành khuy đồng đã đầy.
- `inset 0 0 0 2px #c5ccda` — lỗ khuy rỗng.

### Named Rules
**The No-Lift Rule.** Card, dialog, popover, dropdown đều nằm phẳng trên nền; phân tách bằng viền và nền, không bằng bóng đổ. Nếu một thành phần cần nổi lên, nó đổi nền hoặc đổi viền.

## Shapes

Radius gốc `--radius: 0.5rem` sinh ra thang `sm 4px / md 6px / lg 8px / xl 12px`. Card và KPI dùng `lg`; nút, input, select, fit choice dùng `md`; nhãn dệt và ô heat dùng **2px** — gần vuông, đúng chất nhãn may; nút đồng và scrollbar thumb dùng tròn hoàn toàn.

Hình ngôn ngữ chủ đạo là **đường**, không phải khối: viền 1px hairline khắp nơi, viền 1px piping ở mép shell admin, thanh 3px brass ở mép trái mục nav đang mở, và đường may đứt nét 1px `rgb(201 162 74 / 0.6)` chạy `inset: 2px` bên trong nhãn dệt. Mục nav không bo góc (`rounded-none`) để đọc như một đường chỉ chạy hết chiều ngang thân áo.

## Components

### Buttons
- **Shape:** `rounded-md` (6px); cao 36px mặc định, 32px `sm`, 40px `lg`, 24px `xs` từ `md`. Dưới `md`, các nút tương tác chính đạt tối thiểu 44px.
- **Primary:** nền navy, chữ trắng, `px-4 py-2`; hover `bg-primary/90`.
- **Outline:** nền ground, viền hairline; hover nền `#E9EDF6`, chữ navy.
- **Destructive:** nền piping, chữ trắng.
- **Ghost:** trong suốt; trên nền navy dùng `hover:bg-white/10 hover:text-white`.
- **Focus:** `ring-2 ring-ring ring-offset-2` — navy trên nền sáng, tự đổi sang brass trong vùng `.on-navy`.
- **Disabled:** `opacity-50`, không bắt sự kiện.

### Cards / Containers
- **Corner:** `rounded-lg` (8px). **Nền:** surface trắng. **Viền:** 1px hairline. **Shadow:** không.
- **Padding:** ngang 20px, dọc 16px; khoảng giữa các phần trong card 12px.
- Card có bảng cuộn dùng `-mx-5 px-5` để vùng cuộn chạm mép trong khi nội dung vẫn canh theo padding.

### Inputs / Fields
- Cao 44px dưới `md`, 40px từ `md`; `rounded-md`, nền trong suốt, viền `#C5CCDA`; `text-base` trên mobile và `md:text-sm` để iOS không zoom. Select dùng cùng chiều cao và cùng nhịp với input.
- **Focus:** đổi viền sang ring + `ring-2 ring-offset-2`.
- **Error:** `aria-invalid` → viền piping + `ring-destructive/20`.

### Navigation
- Mục nav: `px-[22px] py-3` (`lg:py-2.5`), 14px weight 500, chữ `#D5DBE8`, không bo góc; hover `bg-white/5` + chữ trắng.
- **Active:** `bg-white/[0.14]`, chữ trắng, cộng `::before` rộng 3px cao hết ô màu brass ở mép trái.
- **Nhóm có mục con** (`Học sinh`, `Cấu hình`): tiêu đề nhóm là nút đóng/mở (`aria-expanded`, chevron xoay 180°), không phải chữ tĩnh. Mặc định mở khi đang ở route của nhóm, đóng khi không; người dùng đóng/mở tự do. Tiêu đề nhóm dùng cùng style mục nav, chữ trắng khi nhóm đang chứa trang hiện tại.
- Wordmark: `G-UNIFORM` 20px bold tracking 0.5px với dấu gạch nối màu brass, dưới là `by GIABACO · EDUCHIC` 10px tracking 1.4px.

### Tabs
- Gạch chân brass 3px chỉ dưới tab đang chọn; dải tab không có hairline đáy (tab dính vào đường viền bị detector tính là cramped).

### Form section và card dữ liệu
- `FormSection`: `rounded-lg`, hairline, `p-4 sm:p-5`, tiêu đề 16px weight 600 navy có hairline dưới (`pb-3`) để tách đầu khối với nội dung. Card cùng cột (ví dụ `Lớp đo`, `Học sinh`, card sản phẩm thử) dùng cùng padding và cùng kiểu tiêu đề để mép trong thẳng hàng; không dùng `fieldset/legend` cho khối có viền.
- Bảng đặt trong khung có viền: khung có `px-2 py-1` để chữ không dính viền.
- Đơn vị đã có trong nhãn (`Chiều cao (cm)`) thì không lặp hậu tố trong ô; `UnitInput` đặt đơn vị cạnh ô, không đè lên ô.
- Câu hướng dẫn dưới tiêu đề: tối đa một dòng ngắn, `max-w-[65ch]`; KPI không liệt kê dữ liệu chi tiết trong dòng phụ.

### Nhãn dệt cỡ (signature)
`SizeLabel` là cách **duy nhất** để hiển thị tên một cỡ — trong bảng, legend, tooltip biểu đồ, danh sách học sinh, trang phụ huynh.
- Nền navy, chữ brass, in hoa, weight 600, `rounded-[2px]`, cộng đường may đứt nét `1px dashed rgb(201 162 74 / 0.6)` đặt `inset: 2px`.
- Ba scale: `sm` `7px/3px` 11px tracking 0.8px (mặc định), `md` `10px/4px` 12px tracking 1px, `lg` `14px/6px` 14px tracking 1.2px.
- `label == null` → biến thể "Chưa xác định": nền hatch 45°, viền `#A9B2C3`, chữ ink, cùng kích thước — nhãn đã tháo chỉ, không phải một cỡ.

### Hàng nút đồng (signature)
`ButtonMeter` đọc một tỉ lệ trên thang 10 khuy.
- Mỗi khuy 24px (`sm:` 26px), tròn, cách nhau 6px, bọc trong `role="img"` có `aria-label` nói rõ con số; từng khuy `aria-hidden`.
- **Đầy:** `radial-gradient(circle at 35% 30%, #e2c47a, #c9a24a 60%, #a07f2e)` + vành `inset` đồng/đồng-tối.
- **Rỗng:** nền surface + vành `inset 0 0 0 2px #c5ccda`.
- Số khuy đầy là `round(filled)` kẹp trong `[0, total]`.

### Lựa chọn fit
`FitChoice` là radiogroup 3 ô (Chật / Vừa / Rộng), ô cao tối thiểu 48px, `rounded-md`, input thật ẩn `sr-only`.
- **Nghỉ:** nền surface, viền `#C5CCDA`, chữ 15px weight 400; hover nền `#E9EDF6`.
- **Chọn:** nền navy, chữ trắng, weight 600, viền 2px navy, thêm dấu check brass 14px ở góc trên phải.
- **Invalid:** ô chưa chọn mang viền piping. **Disabled:** `opacity-50`, bỏ hover.
- Focus đi qua `has-[:focus-visible]:outline-2 outline-offset-2` trên nhãn bọc ngoài.

### Ma trận lớp × cỡ
- Đầu cột là nhãn dệt; ô dữ liệu là link có `backgroundColor` nội suy từ trắng về navy theo `0.1 + (value/max) * 0.72`, ô rỗng dừng ở `0.04`; chữ lấy từ `readableOn(bg)`.
- Ô `rounded-[2px]`, `min-h-11` trên mobile, hover `brightness-95`, focus `ring-2 ring-offset-1`.
- Hàng/cột tổng dùng weight 600, không tô nền.

### Segmented control
`ViewSwitch` bọc `ToggleGroup variant="outline"`: ô cao 36px (`max-sm:` 44px), `px-3.5`; trạng thái `on` là nền navy chữ trắng.

### Badge trạng thái
- Dùng `Badge` với `success`, `info`, `warning`, `danger`, `secondary` hoặc `outline` theo **The State Semantics Rule**; không đặt màu Tailwind thô như `emerald-*`, `green-*`, `amber-*` vào UI trạng thái.
- Nội dung dài trong badge được xuống dòng bằng `max-w-full whitespace-normal break-words`; không để badge đẩy rộng trang.

### States dùng chung
`LoadingRows` (skeleton), `EmptyState`, `ErrorState`, `RouteError`, `NotFound` là bộ trạng thái chuẩn; mọi màn mới phải nối đủ bốn nhánh pending / error / empty / data thay vì tự dựng chuỗi trạng thái riêng.

## Do's and Don'ts

### Do:
- **Do** gọi `SizeLabel` mỗi khi hiển thị tên một cỡ, kể cả trong tooltip và đầu cột bảng.
- **Do** lấy màu series cỡ từ `sizeColor()` và màu chữ từ `readableOn()` / `sizeTextColor()`.
- **Do** dùng `.hatch-unknown` (DOM) hoặc `UNKNOWN_PATTERN_FILL` (SVG) cho "Chưa xác định"; không bao giờ cho nó một màu đặc.
- **Do** giữ vùng chạm ≥ 44px trên mobile (`min-h-11`, `max-sm:h-11`) rồi mới nén lại từ `sm`.
- **Do** đặt `tabular-nums` cho mọi cụm số.
- **Do** phân tách bằng viền 1px hairline và tint navy nhạt.
- **Do** bọc nội dung trang trong `max-w-[1280px]` và dùng nhịp dọc 16px.
- **Do** kèm caption 12px nói rõ "cỡ vừa suy ra" ở mỗi card dẫn số cỡ.
- **Do** canh header, bộ lọc, tabs và nội dung theo cùng một mép trái; giới hạn chiều rộng ở cấp trang hoặc ngữ cảnh.
- **Do** dùng `minmax(0, …)`, `min-w-0` và `items-start` cho grid có nội dung dài hoặc chiều cao khác nhau.
- **Do** dùng token trạng thái `success` / `info` / `warning` / `danger` đúng nghĩa nghiệp vụ.

### Don't:
- **Don't** thêm `box-shadow` khuếch tán; chỉ `inset` của nút đồng được phép.
- **Don't** dùng brass làm nền mảng lớn, màu nút, hay chữ trên nền sáng.
- **Don't** đổ nền đỏ piping; đỏ chỉ là đường viền hoặc tín hiệu destructive/lỗi.
- **Don't** thêm font thứ hai, kể cả mono cho số.
- **Don't** đặt chữ cố định trắng/đen lên ô heat hay thanh biểu đồ — luôn qua `readableOn()`.
- **Don't** bo góc mục nav hay nhãn dệt quá 2px; nhãn gần vuông là chủ ý.
- **Don't** hiển thị chrome chứng minh ("đang cập nhật", "vừa thêm", "live"): dữ liệu tự nói.
- **Don't** dựng lại pending/empty/error riêng khi đã có `LoadingRows` / `EmptyState` / `ErrorState`.
- **Don't** đặt một form hoặc panel hẹp lơ lửng giữa trang rộng chỉ bằng `max-w-*` cục bộ.
- **Don't** để badge, label, control hoặc bảng tạo cuộn ngang toàn trang; chỉ vùng bảng/ma trận được cuộn cục bộ.
- **Don't** dùng warning cho trạng thái chỉ đơn giản là chưa bắt đầu.
- **Don't** để chữ xám (`#D5DBE8`) dạng đoạn tĩnh trên nền navy; tiêu đề trên navy là chữ trắng hoặc là control tương tác.
- **Don't** viết đoạn hướng dẫn nhiều mệnh đề trong form; giữ nhãn, lỗi thật và trạng thái.

### Kiểm tra bằng detector
Mỗi lần sửa UI: quét source bằng `impeccable detect --json frontend/src` và quét trang đã render bằng detector của extension Impeccable (rule `cramped-padding`, `gray-on-color`, `line-length`, `side-tab`, `border-accent-on-rounded`, `text-occlusion`, `nested-cards` chỉ bắt được trên DOM thật); kiểm `page.url()` sau mỗi lần mở để chắc không bị chuyển về `/login`. Ngoại lệ đã chấp nhận (false positive): `repeating-stripes-gradient` của hatch "Chưa xác định", và `layout-transition` sinh từ CSS nội tuyến của thư viện `sonner` (hiệu ứng xếp chồng toast; không ghi đè).
