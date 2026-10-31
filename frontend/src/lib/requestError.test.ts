import { describe, expect, it } from 'vitest'
import { ApiError, parseApiError } from './http'
import { requestErrorMessage } from './requestError'

const FALLBACK = 'Chưa lưu được thay đổi. Vui lòng thử lại sau ít phút.'

describe('requestErrorMessage', () => {
  it('turns the Retry-After wait into whole minutes', () => {
    const error = new ApiError(429, 'rate_limited', 'x', undefined, { retryAfterS: 840 })
    expect(requestErrorMessage(error, FALLBACK)).toBe(
      'Bạn thao tác quá nhanh. Vui lòng đợi 14 phút rồi thử lại.',
    )
  })

  it('rounds a partial minute up and says "vài phút" when the wait is unknown', () => {
    const soon = new ApiError(429, 'rate_limited', 'x', undefined, { retryAfterS: 61 })
    expect(requestErrorMessage(soon, FALLBACK)).toContain('đợi 2 phút')
    expect(requestErrorMessage(new ApiError(429, 'rate_limited', 'x'), FALLBACK)).toContain('vài phút')
  })

  it('explains a proxy outage instead of using the form fallback', () => {
    const error = new ApiError(502, 'http_error', 'x')
    expect(requestErrorMessage(error, FALLBACK)).toContain('khởi động lại hoặc bảo trì')
  })

  it('uses the form fallback for other failures', () => {
    expect(requestErrorMessage(new ApiError(500, 'internal_error', 'x'), FALLBACK)).toBe(FALLBACK)
  })
})

describe('parseApiError', () => {
  it('reads the request reference and wait time from the response', async () => {
    const res = new Response(
      JSON.stringify({ error: { code: 'rate_limited', message: 'm', request_id: 'abc123def456' } }),
      { status: 429, headers: { 'Retry-After': '900' } },
    )
    const error = await parseApiError(res)
    expect(error.requestId).toBe('abc123def456')
    expect(error.retryAfterS).toBe(900)
  })

  it('names an oversized upload even when the body is not JSON', async () => {
    const error = await parseApiError(new Response('Content Too Large', { status: 413 }))
    expect(error.message).toContain('quá lớn')
  })
})
