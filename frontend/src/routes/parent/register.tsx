import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { safeParentRedirect } from '@/features/parent_accounts/authLogic'
import { RegisterForm } from '@/features/parent_accounts/components/RegisterForm'
import { parentMeQueryOptions } from '@/features/parent_accounts/hooks'

export const Route = createFileRoute('/parent/register')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeParentRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    const account = await context.queryClient.ensureQueryData(parentMeQueryOptions()).catch(() => null)
    if (account) throw redirect({ to: search.redirect ?? '/parent' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Tạo tài khoản phụ huynh · G-UNIFORM'
  }, [])
  return <RegisterForm redirect={target} onSuccess={() => void navigate({ to: target ?? '/parent' })} />
}
