import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { PARENT_BTN, PARENT_CONTROL, ParentHeading, ParentShell } from '@/components/ParentShell'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/formFocus'
import { ApiError } from '@/lib/http'
import { MIN_PASSWORD_LENGTH, toRegisterBody, validateRegister, type RegisterErrors, type RegisterValues } from '../authLogic'
import { useParentRegister } from '../hooks'
import { authErrorMessage } from './authErrors'

const EMPTY: RegisterValues = { full_name: '', email: '', phone: '', password: '' }

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
    <ParentShell>
      <ParentHeading title="Tạo tài khoản phụ huynh">Dùng tài khoản này để xem số đo và chọn cỡ áo cho con.</ParentHeading>
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field id="full_name" label="Họ và tên của bạn" error={errors.full_name}>
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
        <fieldset className="flex flex-col gap-5">
          <legend className="mb-2 text-[15px] text-muted-foreground">
            Nhập email hoặc số điện thoại, dùng để đăng nhập lần sau
          </legend>
          <Field id="email" label="Email" error={errors.email}>
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
        </fieldset>
        <Field
          id="password"
          label="Mật khẩu"
          hint={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`}
          error={errors.password}
        >
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
        {formError ? (
          <p role="alert" className="font-medium text-destructive">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" className={PARENT_BTN} disabled={register.isPending}>
          {register.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </Button>
      </form>
      <p className="border-t border-hairline pt-4 text-muted-foreground">
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
