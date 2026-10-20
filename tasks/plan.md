# Implementation Plan: Tài khoản phụ huynh (demo)

Spec: `docs/specs/SPEC.md` (DRAFT v5, chờ duyệt). Contract: `docs/specs/api-contract.md`. Intent: `docs/intent/parent-accounts.md`. Task list: `tasks/todo.md`.

Kế hoạch này là DRAFT cho đến khi spec v5 được duyệt. Nếu spec đổi, sửa task tương ứng trước khi code.

## Overview

Thêm đường vào thứ hai cho phụ huynh: đăng ký, đăng nhập, nhận hồ sơ con bằng khớp trường + họ tên + ngày sinh (hoặc tự tạo hồ sơ con), rồi chọn và đổi cỡ trên giao diện `/p/:token` hiện có. QR và admin giữ nguyên.

## Architecture Decisions

- **Slice mới `parent_accounts`** giữ danh tính và liên kết (đăng ký, đăng nhập, nhận con, tạo con). **`parent_portal` mở rộng** để chọn cỡ qua tài khoản. Lý do: slice chỉ được đọc model của slice khác, nên `parent_portal` đọc `ParentStudentLink` từ `parent_accounts.models`, không import handler. Hàm chọn cỡ nằm một chỗ trong `parent_portal`, QR và tài khoản cùng gọi.
- **Hai khóa session trong cùng một cookie** (`username`, `parent_id`). `require_admin` và `require_parent` chỉ đọc khóa của mình. Admin logout hiện gọi `session.clear()`, đổi thành chỉ xóa khóa admin. Không tách cookie vì `SessionMiddleware` chỉ có một cookie và demo không cần hơn.
- **`students.data_source`** (`ADMIN_MEASURED` mặc định, `PARENT_DECLARED`) là chốt cách ly dữ liệu. `stats` và `export/trials` lọc theo cột này. Hồ sơ phụ huynh tự khai không có `fitting_trials` nên không là nhãn huấn luyện.
- **`claim` không nhận `student_id` từ client.** Server tự khớp lại bằng `(school_id, name_key, dob)`. Tránh IDOR kiểu "gửi id học sinh bất kỳ để nhận".
- **Một quy tắc khớp tên duy nhất: `core/names.py:name_key`**, biểu thức SQL áp cho cả cột lẫn tham số. Dùng ở `claim`, `child_exists`, check trùng của admin và việc admin nhận lại hồ sơ tự khai. Trước đây check trùng của admin chỉ `lower(trim)`, lệch với phía phụ huynh, nên tạo bản trùng rồi khóa `claim` bằng `ambiguous_match`.
- **Admin nhận lại hồ sơ tự khai** trong `create_student` (slice `students` chỉ cập nhật model của mình; link không đổi). **Gỡ link** đặt ở slice `parent_accounts` (chủ bảng link), route admin `DELETE /api/students/{id}/parents/{parent_id}`.
- **`normalize_phone` chuyển lên `core/phone.py`** vì hai slice dùng. Cutover sạch, không giữ bản cũ.
- **Không thêm dependency.** Dùng `argon2-cffi` và `unaccent` đã có.

## Dependency graph

```
T1 phone+names ───────┐
T2 schema+models ─────┼─> T4 register/login ─┬─> T5 lookup+claim ─┬─> T9c admin unlink
T3 session separation ┘                      ├─> T6 create+list ──┼─> T6b edit declared
                                             └─> T7 portal by link┘
T2 ─> T8 tách số liệu đo / đơn + /stats/orders ─> T14b thẻ dashboard đơn
T2 ─> T9 admin API data_source+linked_parents ─┐
T1,T2,T6 ─> T9b admin adopts declared ─────────┼─> T14 admin UI
T9c ───────────────────────────────────────────┘
T10 PortalSource refactor (độc lập) ─> T12 parent home ─> T13 add-child UI ─> T13b edit UI
T4 ─> T11 register/login UI ─> T12
all ─> T15 smoke + docs
```

Song song được: T8, T9, T10 với chuỗi T4–T7. Phải tuần tự: T2 trước mọi thứ dùng bảng mới, T4 trước T5/T6/T7.

## Phases và Checkpoints

1. **Foundation** (T1–T3): bảng mới, hàm dùng chung, tách phiên.
2. **Identity** (T4–T6): đăng ký, đăng nhập, nhận con, tạo con.
   - Checkpoint A: `pytest` xanh, một luồng `curl` đăng ký → tạo con → 401 khi dùng cookie sai loại.
3. **Chọn cỡ và cách ly** (T7–T9).
   - Checkpoint B: backend hoàn chỉnh. `pytest`, `ruff`, `mypy` xanh. Luồng QR cũ xanh. `curl` đủ Success Criteria 14–17 phía API.
4. **Frontend** (T10–T14).
   - Checkpoint C: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` xanh. Xem tận mắt trên màn hình điện thoại.
5. **Demo ready** (T15): smoke, tài liệu, Success Criteria 14–18.

## Risks và Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Khớp tên + dob + trường cho người lạ nhận con của người khác | High (PII trẻ em) | Đã chấp nhận cho demo. Giảm: rate limit 10/phút/IP, `lookup` không trả số đo, `claim` tự khớp lại. Dữ liệu thật phải đổi sang `portal_token` hoặc OTP trước |
| Hai loại phiên chung một cookie, lẫn quyền | High | T3 có test: cookie chỉ có `parent_id` không qua route admin và ngược lại; logout một bên giữ bên kia |
| `unaccent` xử lý `đ`/`Đ` không như mong đợi | Medium | T5 có test với tên có `Đ`. Nếu sai, thay bằng `translate` |
| Rate limit 10/phút/IP chặn nhiều phụ huynh cùng Wi-Fi khi demo | Medium | Limiter nằm trong `core/security.py`, một hằng số. Tăng khi cần |
| Hai học sinh khác lớp cùng tên + dob + trường | Low | 409 `ambiguous_match`, hướng dẫn liên hệ Giabaco |
| Refactor `PortalPage` (647 dòng) làm hỏng luồng QR | Medium | T10 chỉ đổi cách lấy dữ liệu qua adapter, không đổi UI. `choices.test.ts` và luồng `/p/:token` xem tay trước và sau |
| Stats hoặc export vô tình đếm hồ sơ tự khai | High (nhiễm dữ liệu huấn luyện) | T8 test: tạo `PARENT_DECLARED` rồi kiểm số liệu `stats` và dòng `export/trials` không đổi |
| Test dùng chung một `AsyncClient` nên cookie admin và phụ huynh lẫn | Medium | Test phụ huynh tạo client riêng. `_clean` thêm bảng mới vào `TRUNCATE` (T2) |

## Open Questions

Các mục "Còn mở" trong `docs/specs/SPEC.md` (trường chưa có trong danh mục, nhận nhầm con, thời hạn phiên, admin xem phụ huynh nào nhận em nào, sửa số đo hồ sơ tự khai). Mỗi mục có mặc định, không chặn T1–T15.
