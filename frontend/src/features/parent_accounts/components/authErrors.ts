import { ApiError } from '@/lib/http'

const SESSION_HINT = 'Trình duyệt không lưu được phiên đăng nhập. Hãy mở trang bằng địa chỉ https://.'

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'session_not_stored') return SESSION_HINT
    if (error.code === 'invalid_credentials') return 'Email, số điện thoại hoặc mật khẩu không đúng.'
    if (error.code === 'account_exists') return error.message
    if (error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau 1 phút.'
    if (error.status === 0) return error.message
  }
  return fallback
}
