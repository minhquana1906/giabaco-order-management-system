import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { meQueryOptions } from '@/features/auth/hooks'

function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(meQueryOptions()).catch(() => null)
    if (session) throw redirect({ to: search.redirect ?? '/dashboard' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Đăng nhập · G-UNIFORM'
  }, [])
  return <LoginForm onSuccess={() => void navigate({ to: target ?? '/dashboard' })} />
}
