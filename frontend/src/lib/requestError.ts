import { ApiError, MAINTENANCE_MESSAGE } from '@/lib/http'

/** Wait hint for a 429, in whole minutes, from the server's `Retry-After` header. */
function rateLimitMessage(retryAfterS?: number): string {
  const wait = retryAfterS ? `${Math.ceil(retryAfterS / 60)} phút` : 'vài phút'
  return `Bạn thao tác quá nhanh. Vui lòng đợi ${wait} rồi thử lại.`
}

/** Text for a failed request: connection, rate-limit and maintenance cases are explained, the rest use `fallback`. */
export function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return rateLimitMessage(error.retryAfterS)
    if (error.status === 0) return error.message
    if (error.code === 'db_unavailable' || [502, 503, 504].includes(error.status)) {
      return error.code === 'db_unavailable' ? error.message : MAINTENANCE_MESSAGE
    }
  }
  return fallback
}
