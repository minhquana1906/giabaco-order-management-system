import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { ApiError } from '@/lib/http'
import { safeParentRedirect } from './authLogic'
import { parentMeQueryOptions } from './hooks'

export async function requireParentSession(queryClient: QueryClient, href: string) {
  try {
    await queryClient.ensureQueryData(parentMeQueryOptions())
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: '/parent/login', search: { redirect: href } })
    }
    throw error
  }
}

export function parentRedirectSearch(search: Record<string, unknown>): { redirect?: string } {
  return { redirect: safeParentRedirect(search.redirect) }
}

export async function redirectWhenSignedIn(queryClient: QueryClient, target: string | undefined) {
  const account = await queryClient.ensureQueryData(parentMeQueryOptions()).catch(() => null)
  if (account) throw redirect({ href: target ?? '/parent' })
}
