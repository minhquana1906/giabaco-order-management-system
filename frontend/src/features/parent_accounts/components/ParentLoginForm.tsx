import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { Hotline, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useParentLogin } from '../hooks'
import { authErrorMessage } from './authErrors'

export function ParentLoginForm({ redirect, onSuccess }: { redirect?: string; onSuccess: () => void }) {
  const login = useParentLogin()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ identifier: identifier.trim(), password }, { onSuccess })
  }

  return (
    <ParentShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-navy">Đăng nhập phụ huynh</h1>
        <p className="text-balance text-muted-foreground">
          Xem số đo và chọn cỡ áo cho con bằng tài khoản của bạn.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field id="identifier" label="Email hoặc số điện thoại">
          {(control) => (
            <Input
              {...control}
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className="h-12 text-[17px]"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          )}
        </Field>
        <Field id="password" label="Mật khẩu">
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="current-password"
              required
              className="h-12 text-[17px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
