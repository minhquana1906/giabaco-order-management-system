import { ApiError, GENERIC_ERROR_MESSAGE } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'

export function campaignErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_ERROR_MESSAGE
  const fields = error.fields ? Object.values(error.fields) : []
  return requestErrorMessage(error, fields.length > 0 ? fields.join('. ') : error.message)
}
