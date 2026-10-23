import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { PageHead, Panel } from '@/components/ParentPage'
import { PARENT_BTN, PARENT_CONTROL, ParentShell } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/formFocus'
import { requestErrorMessage } from '@/lib/requestError'
import { validateForgot } from '../authLogic'
import { useForgotPassword } from '../hooks'

export function ForgotPasswordForm() {
  const forgot = useForgotPassword()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const formRef = useRef<HTMLFormElement>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateForgot(email)
    setError(found)
    if (found) {
      focusFirstInvalid(formRef)
      return
    }
    forgot.mutate(email.trim())
  }

  if (forgot.isSuccess) {
    return (
      <ParentShell center>
        <PageHead title="Kiểm tra email của bạn" divider={false} />
        <Panel flush>
          <p role="status">
            Nếu email có trong hệ thống, chúng tôi đã gửi một liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp
            thư đến (và thư mục Spam). Liên kết có hiệu lực 30 phút.
          </p>
        </Panel>
        <Link
          to="/parent/login"
          search={{}}
          className="inline-flex min-h-11 items-center font-semibold text-navy underline"
        >
          Quay lại đăng nhập
        </Link>
      </ParentShell>
    )
  }

  return (
    <ParentShell center>
      <PageHead title="Quên mật khẩu" divider={false} />
      <form ref={formRef} onSubmit={submit} noValidate>
        <Panel flush>
          <Field id="email" label="Email đã đăng ký" error={error}>
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className={PARENT_CONTROL}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(undefined)
                }}
              />
            )}
          </Field>
          {forgot.isError ? (
            <p role="alert" className="font-medium text-destructive">
              {requestErrorMessage(forgot.error, 'Chưa gửi được yêu cầu. Vui lòng thử lại.')}
            </p>
          ) : null}
          <Button type="submit" size="lg" className={PARENT_BTN} disabled={forgot.isPending}>
            {forgot.isPending ? 'Đang gửi…' : 'Gửi liên kết đặt lại mật khẩu'}
          </Button>
        </Panel>
      </form>
      <Link
        to="/parent/login"
        search={{}}
        className="inline-flex min-h-11 items-center font-semibold text-navy underline"
      >
        Quay lại đăng nhập
      </Link>
    </ParentShell>
  )
}
