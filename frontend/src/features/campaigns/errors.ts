import { ApiError } from '@/lib/http'

export function campaignErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'
  const fields = error.fields ? Object.values(error.fields) : []
  return fields.length > 0 ? fields.join('. ') : error.message
}
