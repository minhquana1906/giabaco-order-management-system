## Open Questions

- cung cấp thêm thông tin size gợi ý dựa trên chiều cao, cân nặng, giới tính của học sinh (ví dụ: bảng mapping Height/Weight -> Size).
- xuất hoá đơn điện tử cho từng phụ huynh hay 1 hoá đơn tổng hợp cho cả trường? (cần xác định rõ quy trình kế toán và đối soát)
- đóng gói theo mã đơn hoặc mã người nhận -> đóng gói gửi về trường (In phiếu đóng gói (Packing Slip) gom theo Khối/Lớp. Khi đó, kiện hàng của mỗi lớp sẽ gồm đúng danh sách học sinh của lớp đó để giáo viên chủ nhiệm phát trong 15 phút mà không bị nhầm lẫn.)
- Nhà trường có sẵn sàng cung cấp file Excel danh sách học sinh kèm số điện thoại phụ huynh để import trước không? (Nếu trường không cung cấp số điện thoại (do lo ngại bảo mật thông tin học sinh): Phụ huynh sẽ claim học sinh bằng cách nào? (Giải pháp: Cấp cho mỗi học sinh 1 thẻ cứng chứa mã QR định danh kèm Token bí mật mang về cho bố mẹ quét).)

## Coding

- Biên: cận dưới gồm, cận trên loại. Ví dụ 120 cm thuộc Cỡ 2.
- Hai chiều lệch nhau: tìm cỡ theo chiều cao và theo cân nặng riêng, lấy cỡ lớn hơn. Ví dụ 120 cm / 18 kg gợi ý Cỡ 2, vì chiều cao cho Cỡ 2 còn cân nặng cho Cỡ 1. Chỉ một
   chiều ra cỡ thì lấy cỡ đó, không chiều nào ra thì không gợi ý.
- Cỡ 0: bỏ qua, vì nằm ngoài bộ cỡ 1–7 của sản phẩm (đã chốt trước đó).
- Cỡ 7: không giới hạn trên, vì ảnh ghi "45 – trên 50 kg" mà không rõ khoảng 50 kg.
- Sản phẩm áp dụng: cả blazer và gile dùng chung bảng, vì ảnh chỉ ghi "Bảng hướng dẫn chọn kích cỡ" chung.
