import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { PageHead, Panel } from '@/components/ParentPage'
import { PARENT_BTN, PARENT_CONTROL, ParentShell } from '@/components/ParentShell'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/formFocus'
import { ApiError } from '@/lib/http'
import { toRegisterBody, validateRegister, type RegisterErrors, type RegisterValues } from '../authLogic'
import { useParentRegister } from '../hooks'
import { authErrorMessage } from './authErrors'

const EMPTY: RegisterValues = { full_name: '', email: '', phone: '', password: '', confirm_password: '' }

function serverFieldErrors(error: unknown): RegisterErrors {
  if (!(error instanceof ApiError) || error.status !== 422 || !error.fields) return {}
  const { fields } = error
  return {
    full_name: fields.full_name,
    email: fields.email,
    phone: fields.phone,
    password: fields.password,
  }
}

export function RegisterForm({ redirect, onSuccess }: { redirect?: string; onSuccess: () => void }) {
  const register = useParentRegister()
  const [values, setValues] = useState<RegisterValues>(EMPTY)
  const [clientErrors, setClientErrors] = useState<RegisterErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  const set = (key: keyof RegisterValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setClientErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateRegister(values)
    setClientErrors(errors)
    if (Object.values(errors).some(Boolean)) {
      focusFirstInvalid(formRef)
      return
    }
    register.mutate(toRegisterBody(values), { onSuccess })
  }

  const serverErrors = serverFieldErrors(register.error)
  const errors = { ...serverErrors, ...clientErrors }
  const formError =
    register.isError && Object.values(serverErrors).every((m) => !m)
      ? authErrorMessage(register.error, 'Không tạo được tài khoản. Vui lòng thử lại.')
      : null

  return (
    <ParentShell center>
      <PageHead title="Tạo tài khoản" divider={false} />
      <form ref={formRef} onSubmit={submit} noValidate>
        <Panel flush>
          <Field id="full_name" label="Họ và tên" error={errors.full_name}>
            {(control) => (
              <Input
                {...control}
                name="name"
                autoComplete="name"
                className={PARENT_CONTROL}
                value={values.full_name}
                onChange={(e) => set('full_name', e.target.value)}
              />
            )}
          </Field>
          <Field id="email" label="Email (không bắt buộc)" error={errors.email}>
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
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
              />
            )}
          </Field>
          <Field id="phone" label="Số điện thoại" error={errors.phone}>
            {(control) => (
              <Input
                {...control}
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={PARENT_CONTROL}
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            )}
          </Field>
          <Field id="password" label="Mật khẩu" error={errors.password}>
            {(control) => (
              <PasswordInput
                {...control}
                name="new-password"
                autoComplete="new-password"
                className={PARENT_CONTROL}
                value={values.password}
                onChange={(e) => set('password', e.target.value)}
              />
            )}
          </Field>
          <Field id="confirm_password" label="Xác nhận mật khẩu" error={errors.confirm_password}>
            {(control) => (
              <PasswordInput
                {...control}
                name="confirm-password"
                autoComplete="new-password"
                className={PARENT_CONTROL}
                value={values.confirm_password}
                onChange={(e) => set('confirm_password', e.target.value)}
              />
            )}
          </Field>
          {formError ? (
            <p role="alert" className="font-medium text-destructive">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className={PARENT_BTN} disabled={register.isPending}>
            {register.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          </Button>
        </Panel>
      </form>
      <p className="text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          to="/parent/login"
          search={{ redirect }}
          className="inline-flex min-h-11 items-center font-semibold text-navy underline"
        >
          Đăng nhập
        </Link>
      </p>
    </ParentShell>
  )
}
