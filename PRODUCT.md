# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Nhân viên đo (một tài khoản admin dùng chung):** tại buổi đo thực địa ở trường tiểu học, nhập chiều cao, cân nặng và các lần thử áo (blazer, gile) cho khoảng 100 học sinh. Thiết bị lẫn lộn: điện thoại cầm tay, tablet đặt bàn, laptop. Việc chính: nhập nhanh, đúng, không mất dữ liệu, chuyển sang em tiếp theo trong dưới 3 chạm.
- **Giabaco (ban điều hành):** xem dashboard thời gian thực, thử luồng phụ huynh, đánh giá bảng size tạm.
- **Phụ huynh:** quét QR riêng của con trên điện thoại, xác nhận đúng con, xem số đo và các lần thử, chọn cỡ cho từng sản phẩm. Gần như không cần hướng dẫn, 3–5 bước, một tay.
- Các vai trò sau này (giáo viên, ban giám hiệu, 8 vai trò vận hành Giabaco) chưa thuộc Slice 1.

## Product Purpose

G-UNIFORM là nền tảng đồng phục học đường của Giabaco cho dự án G Blazer. Slice 1 là công cụ thu thập dữ liệu buổi đo: mỗi học sinh có một hồ sơ số đo và nhiều lần thử áo (chật/vừa/rộng), kèm dashboard phân bố cỡ và trang phụ huynh qua QR. Dữ liệu này là tập huấn luyện cho model gợi ý cỡ sau này, nên phải sạch, đầy đủ, không ghi đè âm thầm.

Thành công: nhập đủ 100 học sinh không mất dữ liệu; Giabaco thấy danh sách và biểu đồ cập nhật dưới 2 giây; export dùng được cho huấn luyện.

## Positioning

Cỡ được quyết định bằng lần thử thật trên người học sinh, không chỉ bằng bảng quy đổi. Hệ thống ghi song song cỡ gợi ý (bảng tạm) và cỡ vừa thực tế để đo độ chính xác của bảng, rồi dùng chính token QR của học sinh làm cửa ngõ cho cả vòng đời đồng phục (đăng ký, thanh toán, đổi cỡ ở các slice sau).

## Operating Context

- Buổi đo diễn ra trong trường học, nhịp liên tục, nhiều học sinh xếp hàng; nhân viên vừa đo vừa nhập.
- Quy trình toàn trình G-UNIFORM 10 bước (`assets/materials/quy_trinh_guniform.png`); Slice 1 phục vụ bước 4 "Thu & khóa size" ở mức thu thập.
- Mô hình 3 Nhà (Nhà trường, Phụ huynh, Giabaco) và cổng GO / HOLD / NO-GO là ngôn ngữ vận hành của Giabaco (`docs/references/GIABACO_Van_ban_trien_khai_Mo_hinh_3_Nha_G_UNIFORM_2026.md`).
- Tài liệu đào tạo PH01–PH04, GB01–GB02 (`docs/references/TAI_LIEU_DAO_TAO_SU_DUNG_UNG_DUNG_G_UNIFORM_GIABACO.md`): phụ huynh "1 việc/màn hình, ưu tiên hình ảnh".

## Capabilities and Constraints

- Spec chi tiết: `docs/specs/SPEC.md`. Routes: `/login`, `/students/new`, `/students`, `/students/:id`, `/dashboard`, `/p/:token`.
- Sản phẩm: "Áo Blazer (Vest)" và "Áo Gile", cùng bộ Cỡ 1–7. Danh mục (trường, lớp, sản phẩm, cỡ) nằm trong DB, không hardcode.
- Thuật ngữ: "cỡ gợi ý (bảng tạm)", "cỡ vừa suy ra" (cỡ lớn nhất trong các lần thử FITS), "Chưa xác định", chật / vừa / rộng.
- Chưa có giá, số lượng, thanh toán, chốt sổ, đổi cỡ trong Slice 1.
- Không hiển thị SĐT, email, ngày sinh trên trang phụ huynh. Không ghi PII vào log.

## Brand Commitments

- G-UNIFORM là tên sản phẩm hiển thị nổi bật; Giabaco (logo "GIABACO EDUCHIC") là thương hiệu bảo chứng ở header/footer.
- Logo dùng nguyên vẹn (`assets/materials/logo_giabaco.png`): chữ G tricolor xanh navy / trắng / đỏ viền vàng. Màu logo là gốc của bảng màu, được phép phát triển thêm.
- Giao diện tiếng Việt. Không gắn nhãn "dữ liệu mẫu", "AI tạo" trên UI.
- Pháp nhân: Công ty TNHH TM DV và XNK Gia Bảo (Giabaco.,Ltd), hotline 0835352004, email <Guniform2026@gmail.com> (`assets/materials/giabaco_information.txt`).

## Evidence on Hand

- Logo, QR tài khoản, size chart blazer/gile, sơ đồ quy trình: `assets/materials/`.
- Ảnh app tham khảo (Bootstrap): `assets/refer_app/`. Chỉ là tham khảo nghiệp vụ và dữ liệu (trường thông tin, bảng hướng dẫn chọn kích cỡ Cỡ 1–7, thống kê theo lớp) để đưa vào phần hiển thị khi cần. Giao diện tự thiết kế mới: màu sắc mới, sáng tạo hơn, UX thuận tiện hơn; không sao chép bố cục hay phong cách của các ảnh này.
- Chưa có ảnh sản phẩm thật, chưa có ảnh học sinh, chưa có danh sách học sinh thật. Không bịa khách hàng, số liệu, trường đối tác.

## Product Principles

1. Dữ liệu thật trước tiện lợi: lần thử thật là nhãn, gợi ý chỉ là điền sẵn và luôn được gắn nhãn "bảng tạm".
2. Tốc độ tại hiện trường: thao tác lặp lại ít chạm nhất, giữ ngữ cảnh trường/lớp giữa các học sinh.
3. Phụ huynh không cần đào tạo: một việc mỗi màn hình, chữ lớn, một tay.
4. Mọi thay đổi để lại dấu vết; không mất dữ liệu âm thầm.
5. Một token, cả vòng đời: trang phụ huynh được mở rộng ở slice sau, không làm lại.

## Accessibility & Inclusion

- Phụ huynh đa dạng độ tuổi và mức thành thạo điện thoại: chữ lớn, vùng chạm lớn, tương phản cao, không phụ thuộc màu để phân biệt chật/vừa/rộng.
- Màn nhập liệu dùng được ngoài ánh sáng mạnh hội trường và bằng bàn phím trên laptop.
