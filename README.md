# G-UNIFORM (Giabaco OMS)

Công cụ thu thập số đo và thử áo của học sinh cho dự án G Blazer: form nhập liệu, dashboard thời gian thực, trang phụ huynh qua QR hoặc tài khoản, export CSV/XLSX.

| Tài liệu | Nội dung |
|---|---|
| `PRODUCT.md`, `DESIGN.md` | Định hướng sản phẩm và thiết kế UI |

Stack: FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16 (backend, `uv`); Vite + React + TanStack Router/Query + shadcn/ui + Tailwind (frontend, `pnpm`); Docker Compose + Caddy (production).

## Yêu cầu

`docker` (Compose v2), `uv`, `node` 22, `pnpm`, `make`, `openssl`. Chạy được trên macOS và Linux.

## Chạy local với đầy đủ dữ liệu

```bash
make setup        # hỏi mật khẩu admin (lần đầu), bật DB, cài dependency, migrate, seed catalog
make seed-demo    # nạp dữ liệu mẫu đa dạng
make dev          # backend :8000 + frontend :5173
```

Mở `http://127.0.0.1:5173`, đăng nhập `admin` cùng mật khẩu vừa đặt.

Phụ huynh có hai đường vào: quét QR `/p/<token>` hoặc đăng ký tại `/parent/register` rồi đăng nhập `/parent/login`. Phụ huynh nhận hồ sơ con bằng trường + họ tên + ngày sinh, hoặc tự tạo hồ sơ con (bắt buộc số đo, SĐT phụ huynh; tối đa 10 con mỗi tài khoản; nhãn "Phụ huynh tự khai", không tính vào dashboard đo và `export/trials`). Admin và phụ huynh dùng hai phiên độc lập trong cùng cookie.

Trang chọn cỡ có ảnh sản phẩm theo trường, giới tính và màu: admin tải ảnh lên qua trang Sản phẩm (`/catalog`), ảnh lưu ở volume `uploads` và phục vụ qua `/media/*`. Không có ảnh thì trang hiện "Chưa có thông tin ảnh sản phẩm".

Admin cấu hình trường/lớp tại `/settings/schools`, danh mục gốc (cơ sở sản xuất, nguyên phụ liệu, nhà cung cấp NPL, sản phẩm gốc) tại `/master-data`, và theo dõi tiến độ sản xuất tại `/production`: tiến độ 10 bước theo đợt, phân công theo đối tác (mỗi đối tác có thể nhận bất kỳ bước nào, theo từng sản phẩm hoặc cả đợt) hoặc làm nội bộ Giabaco (bước đặt chế độ `internal`: một bản ghi, người phụ trách nhập tay, không đối tác/sản phẩm/số lượng), hạn hai cấp. Dữ liệu danh mục gốc nằm trong `backend/config/master.seed.yaml` (chép đúng cột các file Excel trong `docs/references/master_data/`, ô placeholder như "Cần bổ sung", "Chờ xác nhận" để trống), nạp bằng migration `master_seed_20261029` khi chạy `alembic upgrade head` (dev và production cùng một nguồn, không ghi đè bản ghi đã có); admin bấm vào một dòng để xem, sửa hoặc xóa hồ sơ, trường bắt buộc còn trống hiện "Cần bổ sung". Cơ sở sản xuất (mã `GUF-*`) là một bảng `production_facilities` duy nhất: hồ sơ, tài khoản đăng nhập và lệnh sản xuất cùng trỏ vào đó; tài khoản của cơ sở có "Trạng thái hợp tác" bắt đầu bằng "Tạm dừng" hoặc "Ngưng" không đăng nhập và không nhận lệnh được. Hồ sơ đang có tài khoản, lệnh, hoặc sản phẩm gốc đang được sản phẩm bán hàng trỏ tới (ô "Mã sản phẩm gốc" trong form sản phẩm) thì không xóa được. Nhân sự cơ sở có tài khoản riêng do admin tạo trong hồ sơ cơ sở ở `/master-data`, đăng nhập tại `/facility/login` (phiên riêng, chỉ thấy lệnh của cơ sở mình). May đo riêng bật theo từng sản phẩm của đợt (`ItemsTab`) sau khi admin cấu hình bộ số đo ở trang sản phẩm; số đo đi kèm đơn, trang admin và sheet "May đo" của file Excel đơn hàng.

Giới hạn đã biết của demo: xác minh nhận con yếu (ai biết trường, tên, ngày sinh đều nhận được), nên dữ liệu thật phải chuyển sang `portal_token` hoặc OTP.

`make seed-demo` nạp 2 trường (mỗi trường chưa có đợt thì được một đợt đang mở gồm các sản phẩm đang bán), 9 lớp, 59 học sinh (148 lần thử, 1 xóa mềm) và các ca biên (ngoài bảng size, chưa thử áo, nhiều cỡ vừa...). Học sinh bị bỏ qua nếu DB đã có học sinh. Script từ chối chạy trên DB không phải `127.0.0.1`/`localhost`. Muốn nạp lại từ đầu (xóa toàn bộ dữ liệu dev):

```bash
make dev-reset
```

Cổng: DB dev `127.0.0.1:55432`, DB test `127.0.0.1:55433` (chỉ do `docker-compose.override.yml` mở, production không mở). Nếu login luôn báo sai dù đúng mật khẩu, kiểm tra process cũ đang giữ port 8000: `lsof -nP -iTCP:8000 -sTCP:LISTEN`.

Thử QR trên điện thoại trong LAN: chạy `pnpm dev --host` trong `frontend/`, đặt `PUBLIC_BASE_URL=http://<IP-LAN>:5173` trong `backend/.env.local`, restart backend.

## Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `make help` | Liệt kê target |
| `make test` | pytest (cần DB test, tự bật) + vitest |
| `make lint` | ruff, mypy, eslint, tsc |
| `make smoke` | Build image production, smoke trong container, tự dọn |
| `make hash` | Hash mật khẩu admin cho `.env` production |
| `make up` / `make logs` | Trên server: chạy và theo dõi stack production |
| `make staff ARGS="add lan"` | Trên server: tạo tài khoản nhân viên (hỏi mật khẩu). Cũng có `passwd`, `disable`, `enable <user>`, `list` |

## CI/CD

`.github/workflows/ci-cd.yml`: PR vào `main` chạy backend (ruff, mypy, pytest), frontend (eslint, tsc, vitest, build) và `make smoke`. Push hoặc merge vào `main` chạy thêm job `deploy`: mở IAP tunnel tới VM, gửi bản release qua SSH tới `scripts/deploy.sh` (khóa CI chỉ chạy được script này). Script `pg_dump` DB vào `~/backups` (giữ 10 bản), thay code, `docker compose up -d --build app caddy`, chờ `healthz`; workflow kiểm tra lại cả hai host. Rollback: chạy workflow thủ công (`Run workflow`) với `ref` là commit cũ trên `main`, chỉ khi hai commit cùng migration head; nếu bản mới đã thêm migration thì khôi phục `~/backups/predeploy-*.sql.gz` (hoặc snapshot) trước, vì image cũ không biết revision mới và sẽ không khởi động.

Thiết lập một lần (gcloud và gh đã đăng nhập): `bash scripts/setup-cd.sh`. Script tạo service account + Workload Identity Federation (chỉ repo này, nhánh `main`), cài khóa deploy và `ADMIN_HOST` trên VM, đặt secrets/variables cho repo.

## Cấu trúc

```
backend/app/core/            config, db, security, audit, events, logging
backend/app/features/<slice> auth, parent_accounts, catalog, students, parent_portal, stats, exports, realtime
backend/config/              catalog.seed.yaml (sản phẩm, bộ cỡ, bảng size tạm)
backend/scripts/seed_demo.py dữ liệu mẫu cho dev
frontend/src/features/<slice> api.ts, hooks.ts, components/
frontend/src/routes/         TanStack Router file-based
scripts/smoke.py             smoke chạy trong container
```
