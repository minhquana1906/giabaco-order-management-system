import { useEffect } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { RegisterForm } from '@/features/parent_accounts/components/RegisterForm'
import { parentRedirectSearch, redirectWhenSignedIn } from '@/features/parent_accounts/guard'

export const Route = createFileRoute('/parent/register')({
  validateSearch: parentRedirectSearch,
  beforeLoad: ({ context, search }) => redirectWhenSignedIn(context.queryClient, search.redirect),
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect: target } = Route.useSearch()
  const router = useRouter()
  useEffect(() => {
    document.title = 'Tạo tài khoản phụ huynh · G-UNIFORM'
  }, [])
  return <RegisterForm redirect={target} onSuccess={() => router.history.push(target ?? '/parent')} />
}
