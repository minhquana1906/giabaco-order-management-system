# SPEC: Khảo sát số đo phụ huynh

Phiếu khảo sát công khai, dựa trên mẫu `docs/references/Phiếu khảo sát Phụ huynh.docx`. Có hai mục đích: (1) dự trù sản xuất và tìm ca cần may đo; (2) tạo dữ liệu cho clustering và phân tích hình thể theo giới tính, tuổi, khu vực để chuyên gia dựng bảng size quy đổi. Dữ liệu này **không** dùng làm nhãn hồi quy. Nhãn hồi quy lấy từ buổi thử của Giabaco tại trường.

## Luồng

- Một link chung `/survey` cho mọi trường, chạy trên host phụ huynh, không cần đăng nhập. Phụ huynh nhập tên trường (có ví dụ chuẩn hóa) và chọn tỉnh/thành phố, phường/xã của trường từ danh sách, nên trường không cần có sẵn trong bảng `schools`. Danh sách là 34 tỉnh/thành và 3.321 phường/xã/đặc khu sau sáp nhập 2025 (nguồn `provinces.open-api.vn` API v2), lưu tĩnh ở `frontend/src/features/surveys/vnUnits.json`. Khi địa giới đổi thì cập nhật lại file này.
- Mỗi lần gửi chỉ thêm một dòng mới vào `survey_responses`. Không ghi vào `students` hay `schools`. Trigger chặn UPDATE. DELETE vẫn được phép để dọn phiếu rác và xử lý yêu cầu xóa dữ liệu của phụ huynh.
- Không có bước xác nhận đồng ý trên form (người dùng chọn giữ form ngắn). Mục đích dùng dữ liệu chưa được nêu trên form.
- Ghép phiếu với học sinh và với bảng `schools` làm sau, do admin hoặc buổi thử tại trường. Nếu cần tạo hoặc sửa hồ sơ từ phiếu thì phải đi qua tài khoản phụ huynh.
- Gửi lại nhiều lần thì có nhiều dòng. File export đánh dấu `Phiếu mới nhất` theo khóa (SĐT, họ tên chuẩn hóa, ngày sinh), không dùng tên trường vì do phụ huynh gõ tay.
- Rate limit gửi phiếu 30 lần/phút/IP, vì cả nhóm Zalo của một lớp có thể gửi cùng lúc qua chung một IP CGNAT của nhà mạng.

## API

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/public/surveys` | 201 `{id}`. Chỉ có trên host phụ huynh |
| GET | `/api/export/surveys.{csv,xlsx}` | admin |

## Trường dữ liệu (`form_version = 2026-10`)

| Nhóm | Trường | Ràng buộc |
|---|---|---|
| Trường | tên trường (nhập tay), tỉnh/thành phố, phường/xã (chọn từ danh sách), lớp (nhập tay, ví dụ `3A1`) | bắt buộc, chuẩn hóa khoảng trắng và NFC. Server không kiểm phường/xã có thuộc tỉnh đó không |
| Khu vực trường | `school_area` (`URBAN` / `RURAL`) | do server suy ra từ loại đơn vị: Phường là thành thị, Xã và Đặc khu là nông thôn. Phụ huynh không nhập |
| Học sinh | họ tên, ngày sinh, giới tính, SĐT Zalo | SĐT chuẩn hóa về `0xxxxxxxxx` |
| Chất lượng số đo | `measured_on`, `measure_method` (`TAPE_TODAY` / `RECENT_RECORD` / `ESTIMATE`) | ngày đo (theo giờ Việt Nam) không ở tương lai, không cũ quá 180 ngày, phải sau ngày sinh |
| Số đo | chiều cao 90–190 cm, cân nặng 10–90 kg (bắt buộc); vòng ngực 40–140, vòng eo 35–140, vòng mông 40–150 cm (tùy chọn) | một chữ số thập phân |
| Ý kiến | `body_traits[]`, `fit_preference`, `past_issues[]`, `supply_option` (`STANDARD` / `TAILOR`) | nội dung lấy theo phiếu Giabaco |

Tên trường do phụ huynh gõ nên cùng một trường có thể có nhiều cách viết. Khi phân tích cần gộp tên trước, hoặc ghép với `schools`.

Form có ba lớp kiểm tra chất lượng:
- Chặn khoảng giá trị ở cả frontend và DB.
- Gợi ý "nhập theo cm" khi phụ huynh nhập đơn vị mét.
- Cảnh báo mềm, không chặn gửi: BMI ngoài khoảng 11–32, vòng eo lớn hơn vòng ngực trên 15 cm, vòng mông nhỏ hơn vòng eo trên 10 cm.

Khi phân tích, nên lọc theo `Cách đo` và `Phiếu mới nhất`.
