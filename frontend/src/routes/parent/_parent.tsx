import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireParentSession } from '@/features/parent_accounts/guard'

export const Route = createFileRoute('/parent/_parent')({
  beforeLoad: ({ context, location }) => requireParentSession(context.queryClient, location.href),
  component: Outlet,
})
