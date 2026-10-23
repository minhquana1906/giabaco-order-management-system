import { QueryClient } from '@tanstack/react-query'
import { isRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireParentSession } from './guard'
import { parentKeys } from './hooks'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('requireParentSession', () => {
  it('uses a fresh cached session without hitting the server', async () => {
    const client = new QueryClient()
    client.setQueryData(parentKeys.me(), { id: 'p1' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(requireParentSession(client, '/parent')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects to login when the server rejects the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: { code: 'unauthorized', message: 'x' } }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const error = await requireParentSession(new QueryClient(), '/parent').catch((e: unknown) => e)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: { to: string; search: unknown } }).options).toMatchObject({
      to: '/parent/login',
      search: { redirect: '/parent' },
    })
  })

  it('lets other failures through instead of redirecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'boom', message: 'x' } }, 500)))
    const error = await requireParentSession(new QueryClient(), '/parent').catch((e: unknown) => e)
    expect(isRedirect(error)).toBe(false)
    expect(error).toBeInstanceOf(Error)
  })

  it('resolves for a valid session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ id: 'p1' })))
    await expect(requireParentSession(new QueryClient(), '/parent')).resolves.toBeUndefined()
  })
})
