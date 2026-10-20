import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('is false when matchMedia is unavailable', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(false)
  })

  it('tracks the media query and follows changes', () => {
    let matches = true
    const listeners = new Set<() => void>()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return matches
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      })),
    )
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(true)

    matches = false
    act(() => listeners.forEach((fn) => fn()))
    expect(result.current).toBe(false)
  })
})
