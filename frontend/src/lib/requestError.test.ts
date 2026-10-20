import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from './requestError'

describe('requestErrorMessage', () => {
  it('explains rate limiting', () => {
    expect(requestErrorMessage(new ApiError(429, 'rate_limited', 'x'), 'fallback')).toMatch(/quá nhanh/)
  })
  it('passes through the network error message', () => {
    expect(requestErrorMessage(new ApiError(0, 'network_error', 'Mất mạng'), 'fallback')).toBe('Mất mạng')
  })
  it('uses the fallback for everything else', () => {
    expect(requestErrorMessage(new ApiError(500, 'boom', 'server'), 'fallback')).toBe('fallback')
    expect(requestErrorMessage(new Error('x'), 'fallback')).toBe('fallback')
  })
})
