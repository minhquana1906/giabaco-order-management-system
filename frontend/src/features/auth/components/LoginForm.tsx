import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/http'
import { useLogin } from '../hooks'

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'session_not_stored')
      return 'Trình duyệt không lưu được phiên đăng nhập. Hãy mở trang bằng địa chỉ https://.'
    if (error.code === 'invalid_credentials') return 'Tên đăng nhập hoặc mật khẩu không đúng.'
    if (error.code === 'rate_limited' || error.status === 429)
      return 'Đăng nhập sai quá nhiều lần. Thử lại sau 1 phút.'
    if (error.status === 0) return error.message
  }
  return 'Không đăng nhập được. Vui lòng thử lại.'
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ username: username.trim(), password }, { onSuccess })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-4">
          <span className="rounded-md bg-white p-1.5">
            <img src="/brand/logo-giabaco.png" alt="Giabaco" className="h-8 w-auto" />
          </span>
          <div>
            <p className="text-2xl font-bold tracking-[0.5px] text-white">
              G<span className="text-brass">-</span>UNIFORM
            </p>
            <p className="text-[10px] font-medium tracking-[1.4px] text-white/70">by GIABACO · EDUCHIC</p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-lg border-t-[3px] border-piping bg-card p-6 text-card-foreground"
        >
          <h1 className="text-2xl font-semibold text-navy">Đăng nhập</h1>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              className="h-11 text-base"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="h-11 pr-12 text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-navy focus-visible:outline-2 focus-visible:outline-ring"
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>
          {login.isError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errorMessage(login.error)}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={login.isPending}>
            {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </main>
  )
}
