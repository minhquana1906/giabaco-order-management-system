import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { NotFound } from '@/components/NotFound'
import { RouteError } from '@/components/RouteError'
import { ApiError } from '@/lib/http'
import { handleQueryError } from '@/lib/sessionExpiry'
import { routeTree } from './routeTree.gen'

function redirectToLogin(area: 'parent' | 'admin') {
  const here = router.state.location
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
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
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
