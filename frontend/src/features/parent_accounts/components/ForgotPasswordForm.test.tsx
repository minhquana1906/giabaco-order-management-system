import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ForgotPasswordForm } from './ForgotPasswordForm'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}))

let fetchMock: Mock

beforeEach(() => {
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ForgotPasswordForm />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

describe('ForgotPasswordForm', () => {
  it('rejects a malformed email without calling the server', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Email đã đăng ký'), 'lan@')
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }))

    expect(await screen.findByText('Email chưa đúng định dạng.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the same generic confirmation after sending', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Email đã đăng ký'), ' lan@example.com ')
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }))

    expect(await screen.findByText(/Nếu email có trong hệ thống/)).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(init.body as string)).toEqual({ email: 'lan@example.com' })
  })
})
