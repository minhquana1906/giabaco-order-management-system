import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ResetPasswordForm } from '@/features/parent_accounts/components/ResetPasswordForm'
import { tokenFromHash } from '@/features/parent_accounts/authLogic'

export const Route = createFileRoute('/parent/reset')({
  component: ResetPage,
})

function ResetPage() {
  const router = useRouter()
  // The token rides in the URL fragment so it never reaches server logs; drop it from history once read.
  const [token] = useState(() => tokenFromHash(window.location.hash))
  useEffect(() => {
    document.title = 'Đặt mật khẩu mới · G-UNIFORM'
    if (window.location.hash) history.replaceState(null, '', window.location.pathname)
  }, [])
  return (
    <ResetPasswordForm
      token={token}
      onSuccess={() => {
        toast.success('Đã đặt lại mật khẩu. Vui lòng đăng nhập.')
        router.history.push('/parent/login')
      }}
    />
  )
}
