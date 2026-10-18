# Hiện trạng dự án

Cập nhật: 2026-10-18. Phạm vi: Slice 1 (thu thập số đo và thử áo, demo). Spec: `docs/specs/SPEC.md`.

## Tóm tắt

Code Slice 1 đã đủ chức năng theo spec và chạy được ở local và trong image production. **Chưa triển khai lên GCE/Cloudflare**, chưa có sự kiểm chứng trên domain thật.

## Chức năng

| Slice | Backend | Frontend | Ghi chú |
|---|---|---|---|
| `auth` | login/logout/me, session cookie, argon2, rate limit 5/phút/IP | `/login` | Một tài khoản admin |
| `catalog` | trường, lớp, sản phẩm, seed từ YAML, `size_guide` | hooks, chọn trường/lớp trong form | Bảng size tạm nằm trong seed |
| `students` | CRUD học sinh + trials trong một transaction, xóa mềm, audit, trùng lặp 409, gợi ý cỡ, cỡ vừa suy ra | `/students`, `/students/new`, `/students/:id`, QR | `suggested_size_label` do server tính |
| `parent_portal` | `/api/public/students/{token}`, chọn cỡ, `noindex`, không trả SĐT/email/dob | `/p/:token` | Rate limit 60/phút/IP |
| `stats` | tổng quan, phân bố cỡ, ma trận lớp × cỡ, độ chính xác bảng size | `/dashboard` | Dùng cỡ vừa suy ra |
| `exports` | students/trials CSV/XLSX, `all.xlsx` | menu export | Có PII, dòng xóa mềm không xuất |
| `realtime` | SSE `/api/events`, ping 15 s | `EventSource` + invalidate query | Một worker uvicorn |

## Hạ tầng và công cụ

- `Dockerfile` nhiều tầng (build SPA, rồi image Python); `docker-compose.yml` gồm `db`, `app`, `cloudflared`; `docker-compose.override.yml` chỉ cho dev (mở port DB, mật khẩu mặc định).
- `Makefile` (`setup`, `seed-demo`, `dev`, `test`, `lint`, `smoke`, `hash`, `up`, `logs`), `scripts/smoke.py`, `backend/scripts/seed_demo.py`.
- Không có CI/CD, Redis, Nginx, Keycloak (theo spec).

## Đã kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| `pytest` | 112 passed (PostgreSQL thật) |
| `ruff`, `mypy` | sạch |
| `pnpm test`, `lint`, `typecheck`, `build` | 16 passed, sạch |
| `make smoke` | healthz 200, SPA `/` và `/login`, 401 route admin, 404 token sai, login OK, SSE `text/event-stream` |
| `make seed-demo` (DB test) | 59 học sinh, 148 trials, 12 học sinh có lựa chọn phụ huynh, chạy lại là no-op |

## Chưa kiểm chứng / còn thiếu

| Việc | Lý do | Tham chiếu |
|---|---|---|
| Tạo tunnel Cloudflare, VM GCE, snapshot schedule | Cần tài khoản của chủ dự án | `docs/runbook.md` mục 3, 4 |
| SSE qua Cloudflare không bị đệm/nén (backend chưa gửi `no-transform`) | Chỉ kiểm được trên domain thật | runbook 4.6 |
| Phục hồi từ snapshot (Success Criteria #10) | Cần GCE | runbook 4.7 |
| Smoke thủ công trên UI và điện thoại thật (QR, realtime hai máy, export mở bằng Excel) | Cần thiết bị | runbook 2.3 |
| 100 học sinh mẫu trên domain thật (Criteria #3) | Không có công cụ; `seed_demo` chỉ chạy local | runbook mục 5 |
| Thẻ độ chính xác dashboard khớp tính tay trên 5 học sinh (Criteria #13) | Chưa đối chiếu | SPEC |

## Rủi ro đã biết

- Image base không ghim phiên bản (`uv:latest`, `cloudflared:latest`): build và verify trước ngày demo, không rebuild trong ngày.
- Rate limit theo IP: nhân viên chung IP wifi trường chia sẻ hạn mức (login 5/phút, public 60/phút).
- SSE bus trong bộ nhớ: bắt buộc `--workers 1`.
- Xóa dữ liệu demo trên VM cần `down -v`, vốn xóa cả `audit_logs`: là ngoại lệ có chốt chặn (runbook mục 5).
- Bảng size tạm và quy tắc "cỡ lớn hơn / cỡ lớn nhất" chờ Giabaco xác nhận (SPEC, Open Questions).

## Bước tiếp theo

1. Thực hiện runbook mục 3–4 (Cloudflare, GCE) và chạy smoke trên domain thật.
2. Chạy bảng smoke thủ công 2.3 trên thiết bị thật.
3. Thử phục hồi snapshot.
4. Chốt checklist demo (runbook mục 6).
