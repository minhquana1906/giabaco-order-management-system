import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { NotFound } from '@/components/NotFound'
import { authKeys } from '@/features/auth/hooks'
import { parentKeys } from '@/features/parent_accounts/hooks'
import { RouteError } from '@/components/RouteError'
import { ApiError } from '@/lib/http'
import { routeTree } from './routeTree.gen'

const PARENT_AUTH_PATHS = ['/parent/login', '/parent/register']

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        const here = router.state.location
        if (here.pathname.startsWith('/parent')) {
          queryClient.removeQueries({ queryKey: parentKeys.me() })
          if (!PARENT_AUTH_PATHS.includes(here.pathname)) {
            void router.navigate({ to: '/parent/login', search: { redirect: here.href } })
          }
          return
        }
        queryClient.removeQueries({ queryKey: authKeys.me() })
        if (here.pathname !== '/login') {
          void router.navigate({ to: '/login', search: { redirect: here.href } })
        }
      }
    },
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
