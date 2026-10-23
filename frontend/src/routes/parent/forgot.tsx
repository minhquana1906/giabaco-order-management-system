import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/parent_accounts/components/ForgotPasswordForm'
import { redirectWhenSignedIn } from '@/features/parent_accounts/guard'

export const Route = createFileRoute('/parent/forgot')({
  beforeLoad: ({ context }) => redirectWhenSignedIn(context.queryClient, undefined),
  component: ForgotPage,
})

function ForgotPage() {
  useEffect(() => {
    document.title = 'Quên mật khẩu · G-UNIFORM'
  }, [])
  return <ForgotPasswordForm />
}
