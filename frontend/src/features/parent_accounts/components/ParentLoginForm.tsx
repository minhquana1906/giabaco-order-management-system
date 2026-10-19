import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { Hotline, PARENT_BTN, PARENT_CONTROL, ParentHeading, ParentShell } from '@/components/ParentShell'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/formFocus'
import { validateLogin, type LoginErrors } from '../authLogic'
import { useParentLogin } from '../hooks'
import { authErrorMessage } from './authErrors'

export function ParentLoginForm({ redirect, onSuccess }: { redirect?: string; onSuccess: () => void }) {
  const login = useParentLogin()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const [errors, setErrors] = useState<LoginErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateLogin({ identifier, password })
    setErrors(found)
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalid(formRef)
      return
    }
    login.mutate({ identifier: identifier.trim(), password }, { onSuccess })
  }

  return (
    <ParentShell>
      <ParentHeading title="Đăng nhập phụ huynh">Xem số đo và chọn cỡ áo cho con bằng tài khoản của bạn.</ParentHeading>
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field id="identifier" label="Email hoặc số điện thoại" error={errors.identifier}>
          {(control) => (
            <Input
              {...control}
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={PARENT_CONTROL}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                setErrors((v) => ({ ...v, identifier: undefined }))
              }}
            />
          )}
        </Field>
        <Field id="password" label="Mật khẩu" error={errors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="current-password"
              className={PARENT_CONTROL}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((v) => ({ ...v, password: undefined }))
              }}
            />
          )}
        </Field>
        {login.isError ? (
          <p role="alert" className="font-medium text-destructive">
            {authErrorMessage(login.error, 'Không đăng nhập được. Vui lòng thử lại.')}
          </p>
        ) : null}
        <Button type="submit" size="lg" className={PARENT_BTN} disabled={login.isPending}>
          {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
      <div className="flex flex-col gap-1 border-t border-hairline pt-4">
        <p className="text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link
            to="/parent/register"
            search={{ redirect }}
            className="inline-flex min-h-11 items-center font-semibold text-navy underline"
          >
            Đăng ký
          </Link>
        </p>
        <Hotline lead="Quên mật khẩu? Liên hệ Giabaco." />
      </div>
    </ParentShell>
  )
}
