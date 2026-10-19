# Task list: Tài khoản phụ huynh

Kế hoạch: `tasks/plan.md`. Lệnh: backend `cd backend && uv run pytest -q <path>`, `uv run ruff check . && uv run ruff format --check .`, `uv run mypy app`. Frontend `cd frontend && pnpm test`, `pnpm lint`, `pnpm tsc --noEmit`, `pnpm build`. Test backend cần DB test (`make setup` đã bật `db-test`).

Cỡ: XS 1 file, S 1–2, M 3–5.

## Phase 1: Foundation

- [x] **T1: Hàm dùng chung: `core/phone.py` và `core/names.py`** (S)
  - Mô tả: chuyển `normalize_phone` lên `core/phone.py`, không giữ bản cũ. Thêm `core/names.py` với `name_key(expr)` trả biểu thức SQL `lower(unaccent(regexp_replace(trim(normalize(expr, NFC)), '\s+', ' ', 'g')))`, áp cho cả cột lẫn tham số để Python và SQL không lệch nhau. `core` không import model nào.
  - Acceptance:
    - [ ] `normalize_phone` hành vi giữ nguyên; `students/schemas.py` import từ `app.core.phone`
    - [ ] `name_key` cho "  nguyen   VAN an" và "Nguyễn Văn An" cùng một giá trị; tên có `Đ`/`đ` khớp bản không dấu (test trên PostgreSQL thật)
  - Verify: `uv run pytest -q tests/features/students tests/core` · `uv run ruff check . && uv run mypy app`
  - Deps: không
  - Files: `backend/app/core/phone.py`, `backend/app/core/names.py`, `backend/app/features/students/schemas.py`, `backend/tests/features/students/test_phone.py`, `backend/tests/core/test_names.py`

- [x] **T2: Bảng và model mới** (S)
  - Mô tả: migration `0002` thêm `students.data_source`, `parent_accounts`, `parent_student_links`. Model cho `parent_accounts`. Bảng mới vào `TRUNCATE` của test.
  - Acceptance:
    - [ ] `alembic upgrade head` trên DB trống chạy được. Học sinh sẵn có nhận `ADMIN_MEASURED`
    - [ ] DB từ chối tài khoản thiếu cả `email` và `phone`, trùng `email`, trùng `phone`, trùng `(parent_id, student_id)`
    - [ ] Toàn bộ `pytest` hiện có vẫn xanh
  - Verify: `uv run pytest -q` · kiểm CHECK/unique bằng một test integration ngắn
  - Deps: không
  - Files: `backend/migrations/versions/0002_parent_accounts.py`, `backend/app/features/students/models.py`, `backend/app/features/parent_accounts/__init__.py`, `backend/app/features/parent_accounts/models.py`, `backend/tests/conftest.py`

- [x] **T3: Tách phiên admin và phụ huynh** (S)
  - Mô tả: thêm `PARENT_SESSION_KEY`, `require_parent`, `verify_password`, limiter cho phụ huynh vào `core/security.py`. Admin logout chỉ xóa khóa admin. Masking log thêm `identifier`, `password`.
  - Acceptance:
    - [ ] Cookie chỉ có `parent_id` gọi `/api/students`, `/api/events` → 401
    - [ ] Cookie chỉ có `username` admin qua `require_parent` → 401
    - [ ] Admin logout giữ `parent_id` trong cùng phiên, và ngược lại
    - [ ] `mask`/log không để lộ `identifier`, `password`
  - Verify: `uv run pytest -q tests/features/auth tests/core` · `uv run mypy app`
  - Deps: không
  - Files: `backend/app/core/security.py`, `backend/app/features/auth/router.py`, `backend/app/core/logging.py`, `backend/tests/features/auth/test_auth.py`, `backend/tests/core/test_logging.py`

## Phase 2: Identity

- [ ] **T4: Phụ huynh đăng ký, đăng nhập, me, đăng xuất** (M)
  - Mô tả: `/api/parent/auth/{register,login,logout,me}`. Đăng ký xong đăng nhập luôn. Định danh email hoặc SĐT. Đăng nhập băm giả khi không có tài khoản.
  - Acceptance:
    - [ ] Đăng ký bằng email, và bằng SĐT (`+84…` → `0…`), đăng nhập lại đúng định danh → 200
    - [ ] Thiếu cả email và SĐT → 422; mật khẩu dưới 8 ký tự → 422; trùng → 409 `account_exists`
    - [ ] Sai định danh hoặc sai mật khẩu → 401 `invalid_credentials`, cùng thông báo
    - [ ] Quá 10 lần/phút/IP → 429
    - [ ] `audit_logs` ghi `parent_account.register` với actor `parent:<id>`; không có email/SĐT/mật khẩu trong log ứng dụng
  - Verify: `uv run pytest -q tests/features/parent_accounts/test_auth.py` · `uv run ruff check . && uv run mypy app`
  - Deps: T2, T3
  - Files: `backend/app/features/parent_accounts/{router,schemas,handler}.py`, `backend/app/main.py`, `backend/tests/features/parent_accounts/test_auth.py`

- [ ] **T5: Tra cứu và nhận con** (M)
  - Mô tả: `POST /api/parent/children/lookup` và `/claim`. Khớp `school_id` + tên chuẩn hóa (hoa/thường, dấu, khoảng trắng) + `dob` trên học sinh chưa xóa mềm. `claim` tự khớp lại, không nhận `student_id`.
  - Acceptance:
    - [ ] "nguyen van an " khớp "Nguyễn Văn An"; tên có `Đ` khớp đúng
    - [ ] Sai ngày sinh hoặc sai trường → `found: false` / 404 `no_match`
    - [ ] Hai học sinh cùng khớp → `ambiguous: true` / 409 `ambiguous_match`
    - [ ] `lookup` không trả chiều cao, cân nặng, dob, SĐT
    - [ ] `claim` hai lần cho cùng con không tạo link thứ hai. Hai phụ huynh nhận cùng một học sinh được
    - [ ] Học sinh đã xóa mềm không khớp. Audit `parent_student_link.create`. Giới hạn 10 lần/phút/IP
  - Verify: `uv run pytest -q tests/features/parent_accounts/test_claim.py` · ruff, mypy
  - Deps: T4
  - Files: `backend/app/features/parent_accounts/{router,schemas,handler}.py`, `backend/tests/features/parent_accounts/test_claim.py`

- [ ] **T6: Tự tạo con, danh sách con, danh mục trường/lớp** (M)
  - Mô tả: `POST /api/parent/children` (tạo `PARENT_DECLARED` + link `CREATED`), `GET /api/parent/children`, `GET /api/parent/schools`, `GET /api/parent/schools/{id}/classes`. Publish topic `students`.
  - Acceptance:
    - [ ] Tạo con hợp lệ → 201, `data_source = PARENT_DECLARED`, có `portal_token`, không có `fitting_trials`
    - [ ] Chiều cao/cân nặng ngoài 90–190 / 10–90 → 422. Lớp không thuộc trường → 422
    - [ ] Đã có hồ sơ khớp trường + tên + dob → 409 `child_exists`
    - [ ] `GET /parent/children` chỉ trả con của phụ huynh đó, kèm `choices`; học sinh đã xóa mềm không hiện
    - [ ] Audit `student.create` actor `parent:<id>`; SSE phát `students` sau commit, không phát khi rollback
  - Verify: `uv run pytest -q tests/features/parent_accounts` · ruff, mypy
  - Deps: T4
  - Files: `backend/app/features/parent_accounts/{router,schemas,handler}.py`, `backend/tests/features/parent_accounts/test_children.py`

- [ ] **T6b: Phụ huynh sửa hồ sơ tự khai** (S)
  - Mô tả: `PUT /api/parent/children/{student_id}` `{class_id, gender, height_cm, weight_kg}`. Chỉ khi `PARENT_DECLARED`.
  - Acceptance:
    - [ ] Con tự khai đã link → 200, audit `student.update` có `before/after`, actor `parent:<id>`
    - [ ] `ADMIN_MEASURED` → 409 `measured_locked`; chưa link → 404; CHECK số đo và lớp thuộc trường → 422
  - Verify: `uv run pytest -q tests/features/parent_accounts/test_children.py`
  - Deps: T6
  - Files: `backend/app/features/parent_accounts/{router,schemas,handler}.py`, `backend/tests/features/parent_accounts/test_children.py`

### Checkpoint A: Identity
- [ ] `uv run pytest -q` xanh, `ruff` và `mypy` sạch
- [ ] `curl`: đăng ký → tạo con → `GET /parent/children`; cookie admin gọi `/parent/children` → 401; cookie phụ huynh gọi `/api/students` → 401

## Phase 3: Chọn cỡ qua tài khoản và cách ly dữ liệu

- [ ] **T7: Chọn và đổi cỡ theo liên kết tài khoản** (M)
  - Mô tả: `GET /api/parent/children/{id}`, `PUT` và `DELETE .../size-choices/{product_code}`. Tách hàm chọn cỡ theo `student` dùng chung với đường QR. Actor `parent:<id>` cho đường tài khoản, giữ `parent` cho QR.
  - Acceptance:
    - [ ] Con đã link: xem được (cùng schema `/public/students/{token}`, không SĐT/email/dob) và chọn, đổi, xóa cỡ
    - [ ] `PublicStudent` có `data_source` và `suggested_sizes` (từ `size_guide.suggest`); 140 cm / 32 kg → `{"blazer": "4", "gile": "4"}`
    - [ ] Học sinh chưa link, hoặc của phụ huynh khác → 404
    - [ ] Cỡ không thuộc sản phẩm → 422
    - [ ] Audit `choice.set` có `before/after`; SSE `choices` phát
    - [ ] Toàn bộ `tests/features/parent_portal` hiện có vẫn xanh
  - Verify: `uv run pytest -q tests/features/parent_portal` · ruff, mypy
  - Deps: T4, T2
  - Files: `backend/app/features/parent_portal/{router,handler,schemas}.py`, `backend/tests/features/parent_portal/test_portal_account.py`

- [ ] **T8: Tách số liệu đo và số liệu đơn** (M)
  - Mô tả: lọc `data_source = ADMIN_MEASURED` ở `overview`, `size-distribution`, `class-matrix`, `export/trials`. Thêm `GET /api/stats/orders` đếm `parent_size_choices` (mọi `data_source`, bỏ học sinh xóa mềm). `export/students` thêm `data_source` và hai cột lựa chọn mỗi sản phẩm.
  - Acceptance:
    - [ ] Tạo một `PARENT_DECLARED` kèm lựa chọn cỡ: ba endpoint đo không đổi số nào; `/stats/orders` tăng đúng cỡ đó
    - [ ] `export/trials` không có dòng của học sinh này; `export/students` có, đúng `data_source` và cỡ đã chọn
    - [ ] `/stats/orders` không cookie admin → 401
  - Verify: `uv run pytest -q tests/features/stats tests/features/exports`
  - Deps: T2
  - Files: `backend/app/features/stats/{router,schemas,handler}.py`, `backend/app/features/exports/handler.py`, `backend/tests/features/stats/test_stats.py`, `backend/tests/features/exports/test_exports.py`

- [ ] **T9: API admin trả `data_source` và `linked_parents`** (S)
  - Mô tả: `StudentListItem` và `StudentDetail` có `data_source`. `StudentDetail` có `linked_parents` (đọc model `ParentStudentLink`, `ParentAccount`). Admin không gửi được `data_source`.
  - Acceptance:
    - [ ] `GET /students` và `/students/{id}` trả `data_source`; chi tiết trả đúng các phụ huynh đã link
    - [ ] Body `POST/PUT /students` có `data_source` thì bị bỏ qua
    - [ ] `parent_choices` của hồ sơ tự khai hiện trong chi tiết
  - Verify: `uv run pytest -q tests/features/students`
  - Deps: T2
  - Files: `backend/app/features/students/schemas.py`, `backend/app/features/students/handler.py`, `backend/tests/features/students/test_students_api.py`

- [ ] **T9b: Admin nhận lại hồ sơ tự khai khi tạo học sinh** (M)
  - Mô tả: `create_student` khi `force = false`: (1) `_check_duplicate` chỉ xét `ADMIN_MEASURED`, khớp tên bằng `name_key`; (2) đúng một `PARENT_DECLARED` cùng trường + `name_key` + `dob` (bỏ lớp) → cập nhật chính bản đó (lớp, số đo, thông tin phụ huynh, trials, `measured_at = now()`, `data_source = ADMIN_MEASURED`), giữ `id`, `portal_token`, link, lựa chọn cỡ. Audit `student.adopt`.
  - Acceptance:
    - [ ] Kịch bản Success Criteria 19 đạt: không có bản thứ hai, lựa chọn cỡ còn, sau đó `claim` không `ambiguous_match`
    - [ ] `force = true` vẫn tạo bản mới; trùng `ADMIN_MEASURED` vẫn 409 như cũ (test cũ xanh)
    - [ ] `suggested_size_label` của trials được tính theo số đo admin; publish `students`
  - Verify: `uv run pytest -q tests/features/students`
  - Deps: T1, T2, T6
  - Files: `backend/app/features/students/handler.py`, `backend/tests/features/students/test_adopt.py`

- [ ] **T9c: Admin gỡ liên kết phụ huynh** (S)
  - Mô tả: `DELETE /api/students/{id}/parents/{parent_id}` (`require_admin`). Route nằm trong slice `parent_accounts` vì slice này sở hữu bảng link; `students` chỉ đọc.
  - Acceptance:
    - [ ] 204, audit `parent_student_link.delete` có `before`; phụ huynh đó gọi `/api/parent/children/{id}` → 404; lựa chọn cỡ giữ nguyên
    - [ ] Link không tồn tại → 404; cookie phụ huynh → 401
  - Verify: `uv run pytest -q tests/features/parent_accounts`
  - Deps: T5
  - Files: `backend/app/features/parent_accounts/{router,handler}.py`, `backend/tests/features/parent_accounts/test_links.py`

### Checkpoint B: Backend hoàn chỉnh
- [ ] `uv run pytest -q`, `ruff`, `mypy` xanh; luồng QR `/public/*` không đổi hành vi
- [ ] `curl` đủ Success Criteria 14–17 và 19–21 phía API
- [ ] Review với người dùng trước khi sang frontend

## Phase 4: Frontend

- [ ] **T10: `PortalPage` dùng chung cho QR và tài khoản** (M)
  - Mô tả: `PortalPage` nhận một `PortalSource` (`get`, `choose`, `remove`) thay vì `token`, cộng prop `skipIdentity` và `onBack`. Route `/p/$token` truyền source theo token. Khi `data_source = PARENT_DECLARED`: hiện "Ngày khai" thay "Ngày đo", hiện "Phụ huynh tự khai" thay danh sách lần thử trống.
  - Acceptance:
    - [ ] `/p/:token` chạy y như trước (xem tay: xác nhận con, chọn, xác nhận, đổi)
    - [ ] `PortalPage` không còn tham chiếu `token`
    - [ ] `skipIdentity` bắt đầu ở bước số đo; `onBack` mặc định không hiện
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · mở `/p/<token>` thật trên điện thoại hoặc viewport hẹp
  - Deps: không
  - Files: `frontend/src/features/parent_portal/components/PortalPage.tsx`, `frontend/src/features/parent_portal/api.ts`, `frontend/src/features/parent_portal/hooks.ts`, `frontend/src/routes/p/$token.tsx`

- [ ] **T11: Đăng ký và đăng nhập phụ huynh** (M)
  - Mô tả: `/parent/register` và `/parent/login`, tiếng Việt, mobile-first. Ghi chú trên form: "Nhập email hoặc số điện thoại, dùng để đăng nhập lần sau". Dùng `http` client chung.
  - Acceptance:
    - [ ] Đăng ký thành công thì vào `/parent`; trùng → hiện thông báo từ `message`
    - [ ] Đăng nhập sai → thông báo lỗi, không lộ chi tiết nào sai. Có dòng "Quên mật khẩu? Liên hệ Giabaco" kèm hotline
    - [ ] Trang `/login` của admin có link nhỏ "Phụ huynh đăng nhập tại đây" → `/parent/login` (người gõ tên miền gốc bị chuyển về `/dashboard` → `/login`)
    - [ ] Không dùng `fetch` trực tiếp trong component
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · làm tay trên viewport điện thoại
  - Deps: T4
  - Files: `frontend/src/features/parent_accounts/api.ts`, `frontend/src/features/parent_accounts/hooks.ts`, `frontend/src/features/parent_accounts/components/{RegisterForm,ParentLoginForm}.tsx`, `frontend/src/routes/parent/register.tsx`, `frontend/src/routes/parent/login.tsx`

- [ ] **T12: Trang chủ phụ huynh và route con có bảo vệ** (M)
  - Mô tả: layout `_parent` kiểm `/parent/auth/me`, chưa đăng nhập thì về `/parent/login` (không về `/login` admin). `/parent` liệt kê con và nút "Thêm con", nút đăng xuất. `/parent/children/$studentId` dùng `PortalPage` với source theo `student_id`.
  - Acceptance:
    - [ ] Chưa đăng nhập mở `/parent` → `/parent/login`; đăng nhập xong quay lại đúng trang
    - [ ] Danh sách hiện đúng các con và cỡ đã chọn; mở con → chọn, đổi, xác nhận lại được
    - [ ] Đăng xuất phụ huynh không đăng xuất admin ở cùng trình duyệt
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · làm tay: đăng nhập, mở con, đổi cỡ
  - Deps: T10, T11, T6, T7
  - Files: `frontend/src/routes/parent/_parent.tsx` (hoặc layout tương đương), `frontend/src/routes/parent/index.tsx`, `frontend/src/routes/parent/children/$studentId.tsx`, `frontend/src/features/parent_accounts/components/ChildrenList.tsx`, `frontend/src/features/parent_accounts/{api,hooks}.ts`

- [ ] **T13: Thêm con: nhận hồ sơ có sẵn hoặc tự khai** (M)
  - Mô tả: `/parent/children/new`. Bước 1: trường, họ tên, ngày sinh → "Tìm hồ sơ". Khớp thì hiện tên, trường, lớp và hỏi "Đúng con của bạn?" rồi `claim`. Không khớp thì mở form tự khai (lớp, giới tính, chiều cao, cân nặng) rồi tạo.
  - Acceptance:
    - [ ] Khớp → xác nhận → vào trang chọn cỡ của con. Không khớp → form tự khai → tạo → vào trang chọn cỡ
    - [ ] `ambiguous` → "Liên hệ Giabaco" kèm hotline. `child_exists` (người khác vừa tạo) → quay lại bước tìm hồ sơ. Không thấy trường trong danh sách → "Liên hệ Giabaco"
    - [ ] Test Vitest cho logic chọn nhánh (khớp/không khớp/trùng/mơ hồ)
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit`
  - Deps: T5, T6, T12
  - Files: `frontend/src/routes/parent/children/new.tsx`, `frontend/src/features/parent_accounts/components/AddChild.tsx`, `frontend/src/features/parent_accounts/addChildLogic.ts`, `frontend/src/features/parent_accounts/addChildLogic.test.ts`, `frontend/src/features/parent_accounts/{api,hooks}.ts`

- [ ] **T13b: Sửa hồ sơ tự khai** (S)
  - Mô tả: trên trang con `PARENT_DECLARED`, nút "Sửa thông tin" mở lại form tự khai (lớp, giới tính, chiều cao, cân nặng) điền sẵn. Hồ sơ admin đo không có nút.
  - Acceptance:
    - [ ] Sửa xong quay về trang con, số mới hiện ngay; 409 `measured_locked` hiện thông báo và ẩn nút
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · làm tay
  - Deps: T6b, T13
  - Files: `frontend/src/features/parent_accounts/components/AddChild.tsx` (tách form dùng lại), `frontend/src/routes/parent/children/$studentId.tsx`, `frontend/src/features/parent_accounts/{api,hooks}.ts`

- [x] **T14: Phía admin: nhãn tự khai, phụ huynh đã link, gỡ link, thông báo ghép** (M)
  - Mô tả: nhãn "Phụ huynh tự khai" ở danh sách và chi tiết. Chi tiết liệt kê `linked_parents` kèm nút "Gỡ liên kết" (xác nhận trước khi gỡ). Form nhập liệu: phản hồi tạo có `linked_parents` không rỗng → màn hình xác nhận hiện "Đã ghép với hồ sơ phụ huynh tự khai".
  - Acceptance:
    - [ ] Nhãn hiện đúng; học sinh admin đo không có nhãn
    - [ ] Gỡ liên kết xong danh sách cập nhật, không reload trang
    - [ ] Thông báo ghép hiện khi và chỉ khi hồ sơ được nhận lại
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · xem tay
  - Deps: T9, T9b, T9c
  - Files: `frontend/src/features/students/api.ts`, `frontend/src/features/students/hooks.ts`, `frontend/src/features/students/components/StudentList.tsx`, `frontend/src/features/students/components/StudentDetailView.tsx`, `frontend/src/features/students/components/NewStudent.tsx`

- [x] **T14b: Thẻ dashboard "Đơn đặt may theo cỡ"** (S)
  - Mô tả: thẻ mới trên `/dashboard` đọc `/stats/orders`, lọc theo trường, invalidate khi SSE `choices` tới. Ghi chú "Lựa chọn của phụ huynh, khác cỡ vừa suy ra".
  - Acceptance:
    - [ ] Phụ huynh chọn cỡ ở máy khác → thẻ cập nhật trong dưới 2 giây
  - Verify: `pnpm test && pnpm lint && pnpm tsc --noEmit` · xem tay hai trình duyệt
  - Deps: T8
  - Files: `frontend/src/features/stats/{api,hooks}.ts`, `frontend/src/features/stats/components/OrdersCard.tsx`, `frontend/src/features/stats/components/DashboardPage.tsx`, `frontend/src/features/realtime/useRealtime.ts`

### Checkpoint C: Frontend hoàn chỉnh
- [ ] `pnpm test`, `pnpm lint`, `pnpm tsc --noEmit`, `pnpm build` xanh
- [ ] Xem tận mắt trên viewport điện thoại: đăng ký → thêm con (khớp) → chọn cỡ → đổi cỡ; đăng ký khác → tạo con → chọn cỡ
- [ ] Review với người dùng trước khi chốt demo

## Phase 5: Demo ready

- [ ] **T15: Smoke, tài liệu, nghiệm thu** (S)
  - Mô tả: `scripts/smoke.py` thêm luồng phụ huynh (đăng ký, `me`, 401 chéo loại). Cập nhật `docs/agent/status.md` và README (đường vào `/parent`, rủi ro xác minh yếu, giới hạn đặt lại năm sau và quên mật khẩu). Chạy nghiệm thu Success Criteria 14–23.
  - Acceptance:
    - [ ] `make smoke` xanh kèm luồng phụ huynh
    - [ ] Success Criteria 14–23 đã chạy và ghi kết quả, riêng mục 18 bằng `docker compose logs app` sau luồng demo
    - [ ] `docs/agent/status.md` ghi đúng hiện trạng, kể cả mục chưa kiểm chứng
  - Verify: `make test && make lint && make smoke`
  - Deps: T1–T14b
  - Files: `scripts/smoke.py`, `docs/agent/status.md`, `README.md`

### Checkpoint D: Hoàn tất
- [ ] Toàn bộ Success Criteria 14–21 đạt, Success Criteria 1–13 không hồi quy
- [ ] Không còn tham chiếu code hay tài liệu mô tả "một tài khoản duy nhất" sai với hiện trạng
