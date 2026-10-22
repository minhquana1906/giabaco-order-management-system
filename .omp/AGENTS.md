# G-UNIFORM (Giabaco OMS) — Context

Nền tảng G-UNIFORM cho dự án G Blazer của Giabaco. Slice 1 (demo): thu thập số đo và thử áo của học sinh, dashboard, trang phụ huynh qua QR và qua tài khoản phụ huynh. Spec: `docs/specs/SPEC.md`. Nguồn yêu cầu: `.omp/prompts/init.md`, `docs/intent/parent-accounts.md`.

## Stack

- Backend: FastAPI + Pydantic v2, Python, `uv` (skill `fastapi-best-practices`)
- Data/Storage: PostgreSQL 16 + SQLAlchemy 2.0 + Alembic. Không Redis ở Slice 1
- Frontend: Vite + React + TanStack Router/Query + shadcn/ui + Tailwind (skills `tanstack-router-best-practices`, `tanstack-query-best-practices`)
- Infra/CI: Docker Compose trên một GCE instance, Cloudflare Tunnel cho `giabaco.samocdigital.com`, backup bằng snapshot disk GCE (skill `deploy-gitops`). CI/CD qua GitHub Actions (`.github/workflows/ci-cd.yml`)
- Auth: hai loại phiên độc lập, không phải RBAC. Admin: một tài khoản từ env. Phụ huynh: tài khoản trong DB (email hoặc SĐT + mật khẩu). Cùng cơ chế session cookie nhưng hai khóa riêng (`username` và `parent_id`), không dùng khóa này để vượt khóa kia. Không Keycloak
- Realtime: SSE gửi tín hiệu "dữ liệu đổi", client refetch bằng TanStack Query. Một process uvicorn
- Không dùng: Nginx, Redis/Valkey, Kubernetes, queue

## Architecture

- Layout: Vertical Slice. `backend/app/features/<slice>/` (router, schemas, handler, models), `backend/app/core/` dùng chung. Frontend `frontend/src/features/<slice>/`
- Slice chỉ import `core`, được đọc model của slice khác, không import router/schema/handler của slice khác. Ngoại lệ: module helper thuần như `campaigns/pricing.py`, `students/size_guide.py`, `students/fit_rules.py`, `orders/lines.py`, `catalog/images.py`
- Slice: `auth`, `parent_accounts`, `catalog`, `campaigns`, `orders`, `students`, `parent_portal`, `surveys`, `stats`, `exports`, `realtime`

## Commands

Xem mục Commands trong `docs/specs/SPEC.md`.

## Conventions

- UI tiếng Việt. Code, tên biến, commit message tiếng Anh
- Trường, lớp, sản phẩm, bộ cỡ nằm trong DB, nạp bằng `backend/config/catalog.seed.yaml`. Không hardcode
- Mọi thay đổi `students`, `fitting_trials`, và việc phụ huynh nhận hoặc tạo hồ sơ con (`parent_student_links`) ghi `audit_logs`. SPEC v6: `orders`, `order_lines`, `products`, `product_images` (và các bảng đợt khi có) cũng ghi `audit_logs`. Bảng `legacy_parent_size_choices` (trước là `parent_size_choices`) chỉ đọc, không code nào đọc hay ghi

## Do not

- Ghi PII (tên, SĐT, email học sinh/phụ huynh, định danh và mật khẩu đăng nhập của tài khoản phụ huynh) vào log ứng dụng
- Hard delete `students`, `fitting_trials`. UPDATE/DELETE `audit_logs`
- Dùng "cỡ vừa suy ra" làm nhãn trong export huấn luyện
- Đưa học sinh `data_source = PARENT_DECLARED` vào dashboard, `export/trials` hoặc dữ liệu huấn luyện
- Commit `.env` hoặc dữ liệu học sinh thật
- Đưa engine gợi ý cỡ dựa trên dữ liệu (hồi quy/ML) vào Slice 1. Bảng size tạm theo ngưỡng (`products.size_guide`) đã được duyệt
- Dùng chi tiết khác từ `assets/refer_app/` mà chưa hỏi người dùng. Đã được duyệt: bảng hướng dẫn chọn kích cỡ (Cỡ 1–7)
