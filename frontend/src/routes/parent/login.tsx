import { useEffect } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ParentLoginForm } from '@/features/parent_accounts/components/ParentLoginForm'
import { parentRedirectSearch, redirectWhenSignedIn } from '@/features/parent_accounts/guard'

export const Route = createFileRoute('/parent/login')({
  validateSearch: parentRedirectSearch,
  beforeLoad: ({ context, search }) => redirectWhenSignedIn(context.queryClient, search.redirect),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const router = useRouter()
  useEffect(() => {
    document.title = 'Đăng nhập · G-UNIFORM'
  }, [])
  return <ParentLoginForm redirect={target} onSuccess={() => router.history.push(target ?? '/parent')} />
}
