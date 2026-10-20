import { ApiError } from '@/lib/http'

export function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau 1 phút.'
    if (error.status === 0) return error.message
  }
  return fallback
}
