import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { RegisterForm } from './RegisterForm'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let registerResponse: () => Response
let fetchMock: Mock

beforeEach(() => {
  registerResponse = () => json({ id: 'p1', full_name: 'Lan', email: null, phone: '0912345678' })
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/parent/auth/register') return registerResponse()
    return json({ id: 'p1', full_name: 'Lan', email: null, phone: '0912345678' })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const onSuccess = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RegisterForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  )
  return { onSuccess, user: userEvent.setup() }
}

async function fill(user: UserEvent, confirm = 'matkhau123') {
  await user.type(screen.getByLabelText('Họ và tên'), 'Nguyễn Thị Lan')
  await user.type(screen.getByLabelText('Email'), 'lan@example.com')
  await user.type(screen.getByLabelText('Số điện thoại'), '0912345678')
  await user.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
  await user.type(screen.getByLabelText('Xác nhận mật khẩu'), confirm)
}

describe('RegisterForm', () => {
  it('lists the fields in a single column order', () => {
    setup()
    const labels = Array.from(document.querySelectorAll('form label')).map((l) => l.textContent)
    expect(labels).toEqual(['Họ và tên', 'Email', 'Số điện thoại', 'Mật khẩu', 'Xác nhận mật khẩu'])
  })

  it('blocks submit when the confirmation differs', async () => {
    const { user, onSuccess } = setup()
    await fill(user, 'matkhau124')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Mật khẩu xác nhận không khớp.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a phone', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Email'), 'lan@example.com')
    await user.type(screen.getByLabelText('Họ và tên'), 'Lan')
    await user.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'matkhau123')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Vui lòng nhập số điện thoại.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Số điện thoại')).toHaveFocus())
  })

  it('requires an email', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Họ và tên'), 'Lan')
    await user.type(screen.getByLabelText('Số điện thoại'), '0912345678')
    await user.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'matkhau123')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Vui lòng nhập email.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus())
  })

  it('sends name, phone, email and password', async () => {
    const { user, onSuccess } = setup()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/parent/auth/register'))!
    expect(JSON.parse(init.body as string)).toEqual({
      full_name: 'Nguyễn Thị Lan',
      phone: '0912345678',
      email: 'lan@example.com',
      password: 'matkhau123',
    })
  })

  it('maps server 422 errors onto phone and email', async () => {
    registerResponse = () =>
      json(
        { error: { code: 'validation_error', message: 'x', fields: { phone: 'Số điện thoại không hợp lệ', email: 'Email không hợp lệ' } } },
        422,
      )
    const { user } = setup()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument()
  })

  it('shows the duplicate account message', async () => {
    registerResponse = () => json({ error: { code: 'account_exists', message: 'Tài khoản đã tồn tại.' } }, 409)
    const { user } = setup()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản đã tồn tại.')
  })
})
