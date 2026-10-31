import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Circle } from 'lucide-react'
import { Field } from '@/components/Field'
import { PageHead, Panel } from '@/components/ParentPage'
import { PARENT_BTN, PARENT_CONTROL, ParentShell } from '@/components/ParentShell'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { focusFirstInvalid } from '@/lib/formFocus'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { MIN_PASSWORD_LENGTH, passwordCriteria } from '../authLogic'
import { useResetPassword } from '../hooks'

function Criterion({ ok, children }: { ok: boolean; children: string }) {
  const Icon = ok ? Check : Circle
  return (
    <li className={ok ? 'flex items-center gap-2 text-success-ink' : 'flex items-center gap-2 text-muted-foreground'}>
      <Icon className="size-4" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

export function ResetPasswordForm({ token, onSuccess }: { token: string | undefined; onSuccess: () => void }) {
  const reset = useResetPassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const criteria = passwordCriteria(password, confirm)

  const tokenRejected = reset.error instanceof ApiError && reset.error.code === 'invalid_reset_token'
  if (!token || tokenRejected) {
    return (
      <ParentShell center>
        <PageHead title="Liên kết không dùng được" divider={false} />
        <Panel flush>
          <p role="alert">
            Liên kết đặt lại mật khẩu đã hết hạn (sau 30 phút) hoặc đã được dùng. Hãy yêu cầu liên kết mới.
          </p>
          <Button asChild size="lg" className={PARENT_BTN}>
            <Link to="/parent/forgot">Gửi lại yêu cầu mới</Link>
          </Button>
        </Panel>
      </ParentShell>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!criteria.longEnough || !criteria.matches) {
      focusFirstInvalid(formRef)
      return
    }
    reset.mutate({ token, password }, { onSuccess })
  }

  return (
    <ParentShell center>
      <PageHead title="Đặt mật khẩu mới" divider={false} />
      <form ref={formRef} onSubmit={submit} noValidate>
        <Panel flush>
          <Field id="password" label="Mật khẩu mới" error={touched && !criteria.longEnough ? `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` : undefined}>
            {(control) => (
              <PasswordInput
                {...control}
                name="new-password"
                autoComplete="new-password"
                className={PARENT_CONTROL}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field id="confirm_password" label="Xác nhận mật khẩu mới" error={touched && !criteria.matches ? 'Mật khẩu xác nhận chưa giống. Nhập lại đúng mật khẩu ở ô trên.' : undefined}>
            {(control) => (
              <PasswordInput
                {...control}
                name="confirm-password"
                autoComplete="new-password"
                className={PARENT_CONTROL}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </Field>
          <ul aria-label="Yêu cầu mật khẩu" className="flex flex-col gap-1">
            <Criterion ok={criteria.longEnough}>{`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}</Criterion>
            <Criterion ok={criteria.matches}>Khớp với mật khẩu xác nhận</Criterion>
          </ul>
          {reset.isError ? (
            <p role="alert" className="font-medium text-destructive">
              {requestErrorMessage(reset.error, 'Chưa đặt lại được mật khẩu. Vui lòng thử lại sau ít phút.')}
            </p>
          ) : null}
          <Button type="submit" size="lg" className={PARENT_BTN} disabled={reset.isPending}>
            {reset.isPending ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </Button>
        </Panel>
      </form>
    </ParentShell>
  )
}
