import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http'
import { parentKeys, useParentLogin, useParentLogout } from './hooks'

const navigate = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const apiError = (status: number) => json({ error: { code: 'x', message: 'x' } }, status)

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

beforeEach(() => {
  navigate.mockReset()
  toastError.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('useParentLogout', () => {
  it('clears the parent cache and leaves once logout succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const { client, wrapper } = setup()
    client.setQueryData(parentKeys.children(), [{ student_id: 's1' }])
    let duringNavigate: { me: unknown; children: unknown } | null = null
    navigate.mockImplementationOnce(async () => {
      duringNavigate = { me: client.getQueryData(parentKeys.me()), children: client.getQueryData(parentKeys.children()) }
    })
    const { result } = renderHook(() => useParentLogout(), { wrapper })

    await act(() => result.current.mutateAsync())

    expect(navigate).toHaveBeenCalledWith({ to: '/parent/login', search: {} })
    expect(duringNavigate).toEqual({ me: null, children: [{ student_id: 's1' }] })
    expect(client.getQueryData(parentKeys.children())).toBeUndefined()
    expect(client.getQueryData(parentKeys.me())).toBeUndefined()
  })

  it('treats an already-expired session as logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiError(401)))
    const { wrapper } = setup()
    const { result } = renderHook(() => useParentLogout(), { wrapper })

    await act(() => result.current.mutateAsync())

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('stays put, keeps the cache and reports the failure when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiError(500)))
    const { client, wrapper } = setup()
    client.setQueryData(parentKeys.children(), [{ student_id: 's1' }])
    const { result } = renderHook(() => useParentLogout(), { wrapper })

    act(() => result.current.mutate())
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))

    expect(navigate).not.toHaveBeenCalled()
    expect(client.getQueryData(parentKeys.children())).toBeDefined()
  })
})

describe('useParentLogin', () => {
  it('drops a previous account cache before confirming the new session', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(parentKeys.children(), [{ student_id: 'someone-elses' }])
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/parent/auth/login')) return json({ id: 'p2' })
        expect(client.getQueryData(parentKeys.children())).toBeUndefined()
        return json({ id: 'p2', full_name: 'B', email: null, phone: null })
      }),
    )
    const { result } = renderHook(() => useParentLogin(), { wrapper })

    await act(() => result.current.mutateAsync({ identifier: 'b', password: 'x' }))

    expect(client.getQueryData(parentKeys.children())).toBeUndefined()
    expect(client.getQueryData(parentKeys.me())).toMatchObject({ id: 'p2' })
  })

  it('surfaces a rejected login as an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiError(401)))
    const { wrapper } = setup()
    const { result } = renderHook(() => useParentLogin(), { wrapper })
    await expect(act(() => result.current.mutateAsync({ identifier: 'b', password: 'x' }))).rejects.toBeInstanceOf(ApiError)
  })
})
