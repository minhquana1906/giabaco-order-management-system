import type { Query, QueryClient } from '@tanstack/react-query'
import { authKeys } from '@/features/auth/hooks'
import { parentKeys } from '@/features/parent_accounts/hooks'
import { ApiError } from '@/lib/http'

export interface SessionExpiryDeps {
  queryClient: QueryClient
  redirectToLogin: (area: 'parent' | 'admin' | 'facility') => void
}

export function handleQueryError(error: unknown, query: Query<unknown, unknown, unknown, readonly unknown[]>, { queryClient, redirectToLogin }: SessionExpiryDeps) {
  if (!(error instanceof ApiError) || error.status !== 401) return
  // A query dropped by logout must not trigger a redirect that fights the logout navigation.
  if (queryClient.getQueryCache().find({ queryKey: query.queryKey, exact: true }) !== query) return

  if (query.queryKey[0] === parentKeys.all[0]) {
    queryClient.removeQueries({ queryKey: parentKeys.all })
    if (query.queryKey[1] !== parentKeys.me()[1]) redirectToLogin('parent')
    return
  }
  if (query.queryKey[0] === 'production' && window.location.pathname.startsWith('/facility')) {
    queryClient.removeQueries({ queryKey: ['production'] })
    redirectToLogin('facility')
    return
  }
  queryClient.removeQueries({ queryKey: authKeys.me() })
  redirectToLogin('admin')
}
