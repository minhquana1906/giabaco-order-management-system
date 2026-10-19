import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { safeParentRedirect } from '@/features/parent_accounts/authLogic'
import { ParentLoginForm } from '@/features/parent_accounts/components/ParentLoginForm'
import { parentMeQueryOptions } from '@/features/parent_accounts/hooks'

export const Route = createFileRoute('/parent/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeParentRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    const account = await context.queryClient.ensureQueryData(parentMeQueryOptions()).catch(() => null)
    if (account) throw redirect({ to: search.redirect ?? '/parent' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Đăng nhập phụ huynh · G-UNIFORM'
  }, [])
  return <ParentLoginForm redirect={target} onSuccess={() => void navigate({ to: target ?? '/parent' })} />
}
