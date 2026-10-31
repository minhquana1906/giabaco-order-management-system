import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ResetPasswordForm } from './ResetPasswordForm'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: Mock

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function setup(token: string | null = 'tok123') {
  const onSuccess = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ResetPasswordForm token={token ?? undefined} onSuccess={onSuccess} />
    </QueryClientProvider>,
  )
  return { onSuccess, user: userEvent.setup() }
}

describe('ResetPasswordForm', () => {
  it('offers a new request when the link has no token', () => {
    setup(null)
    expect(screen.getByText('Gửi lại yêu cầu mới')).toBeInTheDocument()
  })


  it('does not submit a mismatched confirmation', async () => {
    const { user, onSuccess } = setup()
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'matkhau123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'matkhau124')
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }))

    expect(await screen.findByText('Mật khẩu xác nhận chưa giống. Nhập lại đúng mật khẩu ở ô trên.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('sends the token and new password, then reports success', async () => {
    const { user, onSuccess } = setup()
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'matkhau123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'matkhau123')
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/parent/auth/reset')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'tok123', password: 'matkhau123' })
  })

  it('switches to the expired-link state when the server rejects the token', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'invalid_reset_token', message: 'Liên kết đã hết hạn' } }, 400),
    )
    const { user, onSuccess } = setup()
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'matkhau123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'matkhau123')
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }))

    expect(await screen.findByText('Gửi lại yêu cầu mới')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
