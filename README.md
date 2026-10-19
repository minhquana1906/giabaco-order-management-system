# G-UNIFORM (Giabaco OMS)

Công cụ thu thập số đo và thử áo của học sinh cho dự án G Blazer: form nhập liệu, dashboard thời gian thực, trang phụ huynh qua QR hoặc tài khoản, export CSV/XLSX.

| Tài liệu | Nội dung |
|---|---|
| `PRODUCT.md`, `DESIGN.md` | Định hướng sản phẩm và thiết kế UI |

Stack: FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16 (backend, `uv`); Vite + React + TanStack Router/Query + shadcn/ui + Tailwind (frontend, `pnpm`); Docker Compose + Cloudflare Tunnel (production).

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

Trang chọn cỡ có ảnh sản phẩm theo giới tính (`frontend/public/products/`, nguồn gốc ở `assets/`).

Giới hạn đã biết của demo: xác minh nhận con yếu (ai biết trường, tên, ngày sinh đều nhận được), nên dữ liệu thật phải chuyển sang `portal_token` hoặc OTP; không có quên mật khẩu (phụ huynh liên hệ Giabaco); đặt may lại năm sau ghi đè lựa chọn cũ.

`make seed-demo` nạp 2 trường, 9 lớp, 59 học sinh (148 lần thử, 12 học sinh có lựa chọn của phụ huynh, 1 xóa mềm) và các ca biên (ngoài bảng size, chưa thử áo, nhiều cỡ vừa...). Script bỏ qua nếu DB đã có học sinh và từ chối chạy trên DB không phải `127.0.0.1`/`localhost`. Muốn nạp lại từ đầu (xóa toàn bộ dữ liệu dev):

```bash
docker compose down -v && make setup && make seed-demo
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

Quy ước: UI tiếng Việt, code và commit tiếng Anh; trường, lớp, sản phẩm, bộ cỡ nằm trong DB; mọi thay đổi `students`, `fitting_trials`, `parent_size_choices`, `parent_student_links` ghi `audit_logs`; không hard delete; không ghi PII vào log.
