import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { meQueryOptions } from '@/features/auth/hooks'
import { useRealtime } from '@/features/realtime/useRealtime'
import { ApiError } from '@/lib/http'

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions())
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 0 || error.status >= 500)) {
        throw redirect({ to: '/login', search: { redirect: location.href } })
      }
      throw error
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  useRealtime()
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
