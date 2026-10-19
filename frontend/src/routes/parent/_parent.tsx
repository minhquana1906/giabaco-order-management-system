import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { parentMeQueryOptions } from '@/features/parent_accounts/hooks'
import { ApiError } from '@/lib/http'

export const Route = createFileRoute('/parent/_parent')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(parentMeQueryOptions())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/parent/login', search: { redirect: location.href } })
      }
      throw error
    }
  },
  component: Outlet,
})
