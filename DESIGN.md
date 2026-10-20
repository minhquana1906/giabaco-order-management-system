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

Giao diện được cắt ra từ chính chiếc G Blazer. Sidebar là thân áo len navy `#1B2B4B` viền một đường piping đỏ `#B8323C` dày 3px; vùng làm việc là nền vải sơ mi `#FBFBFD` với các tấm trắng viền hairline; mọi chỗ gọi tên một cỡ đều hiện ra dưới dạng nhãn dệt `CỠ N` chữ đồng trên nền navy, đường may đứt nét bên trong. Thế giới này từ chối kiểu admin SaaS xám với một accent xanh dương: màu ở đây là màu của vật liệu may mặc, không phải của bảng màu framework.

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
- **Chỉ Piping** (`#b8323c`): chỉ dùng làm đường viền 3px ngăn sidebar/header với vùng nội dung, và làm `destructive` cho hành động xóa / trạng thái lỗi. Không dùng làm nền mảng lớn.

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

### Named Rules
**The Size Ramp Rule.** Mọi series dữ liệu theo cỡ phải lấy màu từ `sizeColor(index, count)` — không chọn tay, không dùng bảng `chart-1…5` cho mục đích khác. Cỡ nhỏ nhạt, cỡ lớn đậm; thứ tự màu chính là thứ tự cỡ. Chữ đặt trên màu đó phải đi qua `readableOn()` / `sizeTextColor()`, không hardcode trắng hay đen.

**The Brass Scarcity Rule.** Brass chỉ xuất hiện ở ba chỗ: chữ nhãn dệt, thanh đánh dấu nav đang mở, nút đồng đã đầy (và dấu check của fit đã chọn). Brass không bao giờ là nền của một mảng lớn, không bao giờ là màu nút, không bao giờ là màu chữ trên nền sáng.

**The Piping Rule.** Đỏ `#B8323C` chỉ tồn tại dưới dạng đường: viền 3px của sidebar/header, hoặc viền/chữ của trạng thái lỗi và nút destructive.

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

Shell hai phần: `aside` 220px dính trái, `h-dvh`, nền navy, `border-r-[3px] border-piping`, chỉ hiện từ `lg`. Dưới `lg` nó thu thành header dính cao 56px cùng nền và cùng viền piping, mở sidebar trong `Sheet` rộng 260px (tối đa 85vw).

Vùng nội dung: `main` padding `16px` (`md:` 28px ngang), nội dung bọc trong container `max-w-[1280px]` canh giữa. Nhịp dọc giữa các khối là `16px` (`gap-4`); trong card là `12px`; trong cụm nhãn–giá trị là `4px`.

Grid đã dùng:
- KPI: `grid-cols-2` → `lg:grid-cols-4`, gap 12px → 16px.
- Hàng phân tích: `xl:grid-cols-[minmax(0,1fr)_400px]` — biểu đồ phân bố co giãn, card độ chính xác cố định 400px.
- Fit choice: `grid-cols-3`, gap 8px, mỗi ô cao tối thiểu 48px.

Bảng dày đặc: `text-[13px]`, `min-w-[640px]`, cuộn ngang trong card có `-mx-5 px-5`, cột "Lớp" `sticky left-0` nền trắng; dưới `md` thêm `mask-image` tán mờ mép phải để báo còn nội dung. Ô bảng có `min-h-11` (44px) trên mobile, rút về `py-1.5` từ `sm`.

Breakpoints theo mặc định Tailwind: `sm` 640, `md` 768, `lg` 1024 (điểm đổi shell), `xl` 1280.

### Trang phụ huynh (`ParentShell`, `ParentPage`)

Một shell, một mẫu trang. Dưới `md` (768) là một cột, nút cao 52px, thanh hành động dính đáy; từ `md` panel và lưới hai cột; từ `lg` (1024) header đầy đủ và bố cục desktop. Container tối đa `1120px`, padding ngang 16 / 24 / 32px.

- **Header:** thân navy (`on-navy`), viền piping 3px ở đáy, cao 56px (`lg` 64px), cùng ngôn ngữ với sidebar admin. Trái: wordmark `G-UNIFORM` / `by GIABACO · EDUCHIC` (link về danh sách khi đã đăng nhập). Phải: nút phụ trắng `Thêm hồ sơ mới` (từ `md`) và menu tài khoản (avatar viết tắt tên + tên + chevron) mở dropdown phẳng có `Đăng xuất`; dưới `md` menu này chứa luôn `Thông tin học sinh` và `Thêm hồ sơ mới`. Từ `md` có mục nav `Thông tin học sinh`, trạng thái đang mở là nền `white/8` cộng thanh brass 3px ở đáy. Đường piping là đường may của chính header navy, không còn là một vạch đỏ lẻ trên nền trắng. Trang đăng nhập, đăng ký và `/p/:token` chỉ có wordmark.
- **Footer:** nền trắng, viền hairline trên; logo Giabaco, hotline và email là liên kết `tel:` / `mailto:`. Đây là chỗ duy nhất cho hỗ trợ; không còn câu "Cần hỗ trợ?" lơ lửng cuối trang.
- **Mẫu trang con (`PageHead` → nội dung → `ActionBar`):** `PageHead` đặt tên học sinh 26 / 32px weight 600 navy, dòng `Lớp · Trường` lining, bên phải `Stepper` 3 bước (hoặc `StatusPill` ở màn tổng quan), viền hairline dưới. Nội dung là `Panel` (card hairline, tiêu đề 18px, hành động của panel đặt trong chân panel). `ActionBar` là hàng hành động duy nhất của trang: dính đáy dưới `lg`, tĩnh và canh phải từ `lg`, nút chính ngoài cùng bên phải, `Quay lại` bên trái nó.
- **Chiều rộng:** `narrow` 480 / 520 (xác nhận học sinh QR, hỗ trợ, đăng nhập), `form` 760 (đăng ký, tìm hồ sơ, xác nhận hồ sơ), `wide` 1120 (danh sách, số đo, chọn cỡ, xác nhận lựa chọn, tổng quan, form khai báo / sửa).
- **Tổng quan:** hai cột 3fr / 2fr từ `lg`: `Cỡ đã chọn` (mỗi dòng tên sản phẩm, chấm màu + tên màu, nhãn dệt cỡ; nút `Đổi lựa chọn` ở chân panel) và `Số đo` (nút `Sửa thông tin` ở chân panel). Trạng thái `Đã đăng ký` là pill navy đặc.
- **Số đo:** `Số đo` 340px bên trái, kết quả thử áo theo sản phẩm tự chia cột bên phải; dòng `Vừa` đậm navy, `Chật` / `Rộng` lining.
- **Chọn cỡ:** mỗi sản phẩm một panel: ảnh thu nhỏ bên trái (88px mobile, 220px `md`, 300px `lg`), tên sản phẩm và `Xem bảng thông số` ở trên, `ColourSelect` rồi lưới cỡ `auto-fit minmax(68px, 1fr)`. Ảnh là nút mở lightbox: hover / focus hiện kính lúp tròn navy và nền `navy/10`, `cursor-zoom-in`, trên thiết bị không hover kính lúp luôn hiện. Lightbox là dialog gần toàn màn hình, ảnh `webp` 1600px vừa khung, nút `Phóng to` đổi sang kích thước thật và cuộn để xem chi tiết; `Esc` đóng.
- **Gợi ý cỡ:** khi chưa có lựa chọn đã lưu, cỡ gợi ý được chọn sẵn và mang chip `Gợi ý` (bảng cỡ, tên truy cập có thêm "theo bảng cỡ") hoặc `Thử vừa` (nhân viên đo thấy vừa) đè lên mép trên ô. Màu không bao giờ được chọn sẵn; lựa chọn cũ có `colour = null` giữ ô màu trống, và bấm `Tiếp tục` khi thiếu màu thì viền piping + `Chọn màu` hiện dưới nhóm màu.
- Không thêm câu hướng dẫn, trấn an hay mô tả phụ vào trang phụ huynh; chỉ giữ nhãn, lỗi thật và thông tin trạng thái.

## Elevation & Depth

Hệ thống **phẳng**. Không có một `box-shadow` khuếch tán nào trong code ứng dụng. Độ sâu đến từ ba cơ chế: hairline `#E3E6EC` quanh mọi bề mặt, ba bậc tint navy rất nhạt (`#E9EDF6` / `#EEF1F7` / `#F1F3F7`) cho nền phụ và hover, và độ đậm của chính dữ liệu trong ô heat.

Hai `box-shadow` duy nhất đều là `inset`, dùng để khắc hình khối của nút đồng chứ không để nâng vật thể lên:
- `inset 0 0 0 3px #c9a24a, inset 0 0 0 4px #8a6c22` — vành khuy đồng đã đầy.
- `inset 0 0 0 2px #c5ccda` — lỗ khuy rỗng.

### Named Rules
**The No-Lift Rule.** Card, dialog, popover, dropdown đều nằm phẳng trên nền; phân tách bằng viền và nền, không bằng bóng đổ. Nếu một thành phần cần nổi lên, nó đổi nền hoặc đổi viền.

## Shapes

Radius gốc `--radius: 0.5rem` sinh ra thang `sm 4px / md 6px / lg 8px / xl 12px`. Card và KPI dùng `lg`; nút, input, select, fit choice dùng `md`; nhãn dệt và ô heat dùng **2px** — gần vuông, đúng chất nhãn may; nút đồng và scrollbar thumb dùng tròn hoàn toàn.

Hình ngôn ngữ chủ đạo là **đường**, không phải khối: viền 1px hairline khắp nơi, viền 3px piping ở hai mép shell, thanh 3px brass ở mép trái mục nav đang mở, và đường may đứt nét 1px `rgb(201 162 74 / 0.6)` chạy `inset: 2px` bên trong nhãn dệt. Mục nav không bo góc (`rounded-none`) để đọc như một đường chỉ chạy hết chiều ngang thân áo.

## Components

### Buttons
- **Shape:** `rounded-md` (6px); cao 36px mặc định, 32px `sm`, 40px `lg`, 24px `xs`.
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
- Cao 40px, `rounded-md`, nền trong suốt, viền `#C5CCDA`; `text-base` trên mobile và `md:text-sm` để iOS không zoom.
- **Focus:** đổi viền sang ring + `ring-2 ring-offset-2`.
- **Error:** `aria-invalid` → viền piping + `ring-destructive/20`.

### Navigation
- Mục nav: `px-[22px] py-3` (`lg:py-2.5`), 14px weight 500, chữ `#D5DBE8`, không bo góc; hover `bg-white/5` + chữ trắng.
- **Active:** `bg-white/[0.08]`, chữ trắng, cộng `::before` rộng 3px cao hết ô màu brass ở mép trái.
- Sub-nav sản phẩm: thụt `pl-[34px]`, 13px; khi active thêm nền `bg-brass/[0.14]`.
- Wordmark: `G-UNIFORM` 20px bold tracking 0.5px với dấu gạch nối màu brass, dưới là `by GIABACO · EDUCHIC` 10px tracking 1.4px.

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

### Don't:
- **Don't** thêm `box-shadow` khuếch tán; chỉ `inset` của nút đồng được phép.
- **Don't** dùng brass làm nền mảng lớn, màu nút, hay chữ trên nền sáng.
- **Don't** đổ nền đỏ piping; đỏ chỉ là đường viền hoặc tín hiệu destructive/lỗi.
- **Don't** thêm font thứ hai, kể cả mono cho số.
- **Don't** đặt chữ cố định trắng/đen lên ô heat hay thanh biểu đồ — luôn qua `readableOn()`.
- **Don't** bo góc mục nav hay nhãn dệt quá 2px; nhãn gần vuông là chủ ý.
- **Don't** hiển thị chrome chứng minh ("đang cập nhật", "vừa thêm", "live"): dữ liệu tự nói.
- **Don't** dựng lại pending/empty/error riêng khi đã có `LoadingRows` / `EmptyState` / `ErrorState`.
