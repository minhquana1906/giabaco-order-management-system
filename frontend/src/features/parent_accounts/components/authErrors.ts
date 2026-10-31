import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { SESSION_NOT_STORED_MESSAGE } from '@/features/auth/hooks'

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'session_not_stored') return SESSION_NOT_STORED_MESSAGE
    if (error.code === 'invalid_credentials') return 'Email, số điện thoại hoặc mật khẩu chưa đúng. Kiểm tra lại hoặc bấm "Quên mật khẩu?" để đặt lại.'
    if (error.code === 'account_exists') return error.message
  }
  return requestErrorMessage(error, fallback)
}
