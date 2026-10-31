import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { NotFound } from '@/components/NotFound'
import { RouteError } from '@/components/RouteError'
import { ApiError } from '@/lib/http'
import { handleQueryError } from '@/lib/sessionExpiry'
import { routeTree } from './routeTree.gen'

function redirectToLogin(area: 'parent' | 'admin' | 'facility') {
  const here = router.state.location
  if (area === 'facility') {
    if (here.pathname !== '/facility/login') void router.navigate({ to: '/facility/login' })
    return
  }
  const to = area === 'parent' ? '/parent/login' : '/login'
  if (here.pathname !== to) void router.navigate({ to, search: { redirect: here.href } })
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => handleQueryError(error, query, { queryClient, redirectToLogin }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Only transient outages are retried; a 500 is a bug and would just repeat.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        error instanceof ApiError &&
        [0, 502, 503, 504].includes(error.status),
    },
  },
})

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
