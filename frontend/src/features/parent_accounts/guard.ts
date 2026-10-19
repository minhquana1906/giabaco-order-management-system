import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { ApiError } from '@/lib/http'
import { parentMeQueryOptions } from './hooks'

export async function requireParentSession(queryClient: QueryClient, href: string) {
  try {
    await queryClient.fetchQuery({ ...parentMeQueryOptions(), staleTime: 0 })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: '/parent/login', search: { redirect: href } })
    }
    throw error
  }
}
