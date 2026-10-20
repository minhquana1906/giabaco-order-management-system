import { QueryCache, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { authKeys } from '@/features/auth/hooks'
import { parentKeys } from '@/features/parent_accounts/hooks'
import { ApiError } from '@/lib/http'
import { handleQueryError } from './sessionExpiry'

const unauthorized = () => new ApiError(401, 'unauthorized', 'x')

function setup() {
  const redirectToLogin = vi.fn()
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleQueryError(error, query, { queryClient: client, redirectToLogin }),
    }),
  })
  return { client, redirectToLogin }
}

const fail = (client: QueryClient, queryKey: readonly unknown[]) =>
  client.fetchQuery({ queryKey, queryFn: () => Promise.reject(unauthorized()), retry: false }).catch(() => undefined)

describe('handleQueryError', () => {
  it('drops every parent query and sends parent pages to the parent login', async () => {
    const { client, redirectToLogin } = setup()
    client.setQueryData(parentKeys.me(), { id: 'p1' })
    client.setQueryData(authKeys.me(), { id: 'admin' })

    await fail(client, parentKeys.children())

    expect(redirectToLogin).toHaveBeenCalledExactlyOnceWith('parent')
    expect(client.getQueryData(parentKeys.me())).toBeUndefined()
    expect(client.getQueryData(authKeys.me())).toEqual({ id: 'admin' })
  })

  it('leaves a parent me 401 to the route guards', async () => {
    const { client, redirectToLogin } = setup()
    client.setQueryData(parentKeys.children(), [])

    await fail(client, parentKeys.me())

    expect(redirectToLogin).not.toHaveBeenCalled()
    expect(client.getQueryData(parentKeys.children())).toBeUndefined()
  })

  it('keeps admin 401 handling separate from the parent cache', async () => {
    const { client, redirectToLogin } = setup()
    client.setQueryData(parentKeys.me(), { id: 'p1' })

    await fail(client, ['students'])

    expect(redirectToLogin).toHaveBeenCalledExactlyOnceWith('admin')
    expect(client.getQueryData(parentKeys.me())).toEqual({ id: 'p1' })
  })

  it('ignores a late 401 from a query that logout already removed', async () => {
    const { client, redirectToLogin } = setup()
    let reject!: (error: unknown) => void
    const pending = client
      .fetchQuery({ queryKey: parentKeys.children(), queryFn: () => new Promise((_, r) => (reject = r)), retry: false })
      .catch(() => undefined)

    client.removeQueries({ queryKey: parentKeys.all })
    reject(unauthorized())
    await pending

    expect(redirectToLogin).not.toHaveBeenCalled()
  })

  it('ignores errors that are not 401', async () => {
    const { client, redirectToLogin } = setup()
    await client
      .fetchQuery({ queryKey: parentKeys.children(), queryFn: () => Promise.reject(new ApiError(500, 'x', 'x')), retry: false })
      .catch(() => undefined)
    expect(redirectToLogin).not.toHaveBeenCalled()
  })
})
