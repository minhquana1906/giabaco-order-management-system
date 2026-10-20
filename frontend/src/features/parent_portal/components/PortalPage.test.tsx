import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http'
import type { PortalSource, PublicStudent } from '../api'
import { PortalPage } from './PortalPage'

const student = (patch: Partial<PublicStudent> = {}): PublicStudent => ({
  full_name: 'Nguyễn Văn An',
  school_name: 'Trường A',
  class_name: '2A1',
  gender: 'MALE',
  data_source: 'ADMIN_MEASURED',
  height_cm: 126.5,
  weight_kg: 24,
  measured_at: '2026-10-01T00:00:00Z',
  trials: [],
  products: [{ code: 'blazer', name: 'Áo Blazer', sizes: ['1', '2', '3'] }],
  choices: {},
  suggested_sizes: {},
  ...patch,
})

function stubSource(get: PortalSource['get']): PortalSource {
  return {
    key: ['portal-test'],
    invalidate: ['portal-test'],
    get,
    choose: vi.fn(),
    remove: vi.fn(),
  }
}

function renderPage(source: PortalSource, props: Partial<Parameters<typeof PortalPage>[0]> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PortalPage source={source} {...props} />
    </QueryClientProvider>,
  )
}

describe('PortalPage', () => {
  it('labels parent-declared measurements as declared', async () => {
    renderPage(stubSource(async () => student({ data_source: 'PARENT_DECLARED' })), { skipIdentity: true })

    expect(await screen.findByRole('heading', { name: 'Số đo' })).toBeInTheDocument()
    expect(screen.getByText('Ngày khai')).toBeInTheDocument()
    expect(screen.queryByText('Ngày đo')).not.toBeInTheDocument()
    expect(screen.getByText('Tự khai báo')).toBeInTheDocument()
    expect(screen.getByText('Chưa có kết quả thử áo.')).toBeInTheDocument()
  })

  it('asks for identity confirmation unless skipIdentity is set', async () => {
    renderPage(stubSource(async () => student()))
    expect(await screen.findByRole('heading', { name: 'Xác nhận học sinh' })).toBeInTheDocument()
  })

  it('skips identity for account flows and labels admin measurements as measured', async () => {
    renderPage(stubSource(async () => student()), { skipIdentity: true })
    expect(await screen.findByText('Ngày đo')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Xác nhận học sinh' })).not.toBeInTheDocument()
  })

  it('shows a back button only when the caller provides onBack', async () => {
    const source = stubSource(async () => student())
    renderPage(source, { skipIdentity: true })
    await screen.findByText('Ngày đo')
    expect(screen.queryByRole('button', { name: /Thông tin học sinh/ })).not.toBeInTheDocument()
  })

  it('renders the back button when onBack is given', async () => {
    renderPage(stubSource(async () => student()), { skipIdentity: true, onBack: vi.fn() })
    expect(await screen.findByRole('button', { name: /Thông tin học sinh/ })).toBeInTheDocument()
  })

  it('uses caller-supplied copy for a missing record', async () => {
    const source = stubSource(async () => {
      throw new ApiError(404, 'not_found', 'x')
    })
    renderPage(source, { notFound: { title: 'Không tìm thấy hồ sơ', text: 'Hồ sơ này không còn trong tài khoản của bạn' } })
    expect(await screen.findByText('Hồ sơ này không còn trong tài khoản của bạn')).toBeInTheDocument()
  })

  it('keeps the link-specific copy by default', async () => {
    const source = stubSource(async () => {
      throw new ApiError(404, 'not_found', 'x')
    })
    renderPage(source)
    expect(await screen.findByRole('heading', { name: 'Liên kết không hợp lệ' })).toBeInTheDocument()
  })

  it('prefills a legacy choice with navy, requires re-confirming it, and saves the picked colour', async () => {
    const choose = vi.fn(async () => ({ chosen_at: '2026-10-02T00:00:00Z' }))
    const source = {
      ...stubSource(async () => student({ choices: { blazer: { size_label: '2', colour: null } } })),
      choose,
    }
    const user = userEvent.setup()
    renderPage(source, { skipIdentity: true })

    await user.click(await screen.findByRole('button', { name: 'Đổi lựa chọn' }))
    expect(screen.getByRole('radio', { name: 'Navy' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cỡ 2' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled()

    await user.click(screen.getByRole('radio', { name: 'Ghi' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByText('Ghi')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xác nhận đăng ký' }))
    expect(choose).toHaveBeenCalledWith('blazer', { size_label: '2', colour: 'ghi' })
  })

  it('keeps continue disabled while the saved choice is unchanged', async () => {
    const source = stubSource(async () => student({ choices: { blazer: { size_label: '2', colour: 'ghi' } } }))
    const user = userEvent.setup()
    renderPage(source, { skipIdentity: true })

    await user.click(await screen.findByRole('button', { name: 'Đổi lựa chọn' }))
    expect(screen.getByRole('radio', { name: 'Ghi' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled()
  })
})
