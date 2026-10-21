import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http'
import type { Ordering, PortalSource, PublicStudent } from '../api'
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
  suggested_sizes: {},
  ...patch,
})

const IMG = { url: '/media/blazer.webp', width: 800, height: 700 }

const ordering = (patch: Partial<Ordering> = {}): Ordering => ({
  campaign: { id: 'c', name: 'Đợt 1', status: 'OPEN', closes_at: null },
  kits: [],
  items: [
    {
      product_id: 'p-blazer',
      code: 'blazer',
      name: 'Áo Blazer',
      price: 400000,
      sizes: ['1', '2', '3'],
      colours: [{ code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }],
      image: IMG,
    },
    {
      product_id: 'p-gile',
      code: 'gile',
      name: 'Gile',
      price: null,
      sizes: ['1', '2', '3'],
      colours: [{ code: 'navy', label: 'Navy', hex: '#1b2b4b' }, { code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }],
      image: null,
    },
  ],
  suggested_sizes: {},
  order: null,
  ...patch,
})

function stubSource(
  get: PortalSource['get'],
  getOrdering: PortalSource['getOrdering'] = async () => ordering(),
  saveOrder: PortalSource['saveOrder'] = vi.fn(async () => ordering()),
): PortalSource {
  return { key: ['portal-test'], orderingKey: ['portal-test', 'ordering'], invalidate: ['portal-test'], get, getOrdering, saveOrder }
}

function renderPage(source: PortalSource, props: Partial<Parameters<typeof PortalPage>[0]> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PortalPage source={source} {...props} />
    </QueryClientProvider>,
  )
}

describe('PortalPage', () => {
  it('asks for identity confirmation unless skipIdentity is set', async () => {
    renderPage(stubSource(async () => student()))
    expect(await screen.findByRole('heading', { name: 'Xác nhận học sinh' })).toBeInTheDocument()
  })

  it('labels parent-declared measurements as declared and skips identity for account flows', async () => {
    renderPage(stubSource(async () => student({ data_source: 'PARENT_DECLARED' })), { skipIdentity: true })
    expect(await screen.findByRole('heading', { name: 'Số đo' })).toBeInTheDocument()
    expect(screen.getByText('Ngày khai')).toBeInTheDocument()
    expect(screen.getByText('Tự khai báo')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Xác nhận học sinh' })).not.toBeInTheDocument()
  })

  it('shows the back button only when the caller provides onBack', async () => {
    renderPage(stubSource(async () => student()), { skipIdentity: true, onBack: vi.fn() })
    expect(await screen.findByRole('button', { name: /Thông tin học sinh/ })).toBeInTheDocument()
  })

  it('uses caller-supplied copy for a missing record, and link copy by default', async () => {
    const missing = async () => {
      throw new ApiError(404, 'not_found', 'x')
    }
    renderPage(stubSource(missing), { notFound: { title: 'Không tìm thấy hồ sơ', text: 'Hồ sơ này không còn' } })
    expect(await screen.findByText('Hồ sơ này không còn')).toBeInTheDocument()
  })

  it('tells the parent when the school has no campaign and offers no way to order', async () => {
    renderPage(stubSource(async () => student(), async () => ordering({ campaign: null, kits: [], items: [] })), {
      skipIdentity: true,
    })
    expect(await screen.findByText('Trường chưa mở đăng ký đồng phục')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).not.toBeInTheDocument()
  })

  it('shows a locked campaign order read-only', async () => {
    const order = {
      id: 'o',
      code: 'GB1',
      status: 'SUBMITTED',
      total: 400000,
      has_unpriced: true,
      submitted_at: '2026-10-02T00:00:00Z',
      kit_lines: [],
      item_lines: [{ product_id: 'p-blazer', size_label: '2', colour: 'ghi', qty: 1 }],
    }
    renderPage(
      stubSource(async () => student(), async () => ordering({ campaign: { id: 'c', name: 'Đợt 1', status: 'LOCKED', closes_at: null }, order })),
      { skipIdentity: true },
    )
    expect(await screen.findByText('Tạm tính, chưa thanh toán')).toBeInTheDocument()
    expect(screen.getByText('Một số sản phẩm chưa có giá')).toBeInTheDocument()
    expect(screen.getByText('Áo Blazer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi lựa chọn' })).not.toBeInTheDocument()
  })

  it('walks choose, review and submit; colour appears only for multi-colour items; image or placeholder shows', async () => {
    let current = ordering()
    const saveOrder = vi.fn(async () => (current = ordering({ order: {
      id: 'o', code: 'GB1', status: 'SUBMITTED', total: 400000, has_unpriced: true, submitted_at: '2026-10-02T00:00:00Z',
      kit_lines: [], item_lines: [{ product_id: 'p-blazer', size_label: '2', colour: 'ghi', qty: 1 }],
    } })))
    const user = userEvent.setup()
    renderPage(stubSource(async () => student(), async () => current, saveOrder), { skipIdentity: true })

    await user.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('img', { name: 'Áo Blazer' })).toHaveAttribute('src', '/media/blazer.webp')
    expect(screen.getByRole('img', { name: 'Chưa có thông tin ảnh sản phẩm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Tăng số lượng Áo Blazer' }))
    expect(screen.queryByRole('radiogroup', { name: 'Màu sắc' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng Gile' }))
    expect(screen.getByRole('radiogroup', { name: 'Màu sắc' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Giảm số lượng Gile' }))
    await user.click(screen.getByRole('radio', { name: 'Cỡ 2' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(screen.getByText('Tạm tính, chưa thanh toán')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Gửi đăng ký' })
    expect(send).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Tôi đã kiểm tra thông tin' }))
    await user.click(send)

    expect(saveOrder).toHaveBeenCalledWith({
      kit_lines: [],
      item_lines: [{ product_id: 'p-blazer', size_label: '2', colour: 'ghi', qty: 1 }],
    })
    expect(await screen.findByRole('heading', { name: 'Đăng ký thành công' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xem thông tin đăng ký' }))
    expect(screen.getByRole('button', { name: 'Đổi lựa chọn' })).toBeInTheDocument()
  })

  it('explains why submit is disabled until the review checkbox is ticked', async () => {
    const user = userEvent.setup()
    renderPage(stubSource(async () => student()), { skipIdentity: true })
    await user.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng Áo Blazer' }))
    await user.click(screen.getByRole('radio', { name: 'Cỡ 2' }))
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(screen.getByRole('button', { name: 'Gửi đăng ký' })).toHaveAccessibleDescription(/tích/)
    await user.click(screen.getByRole('checkbox', { name: 'Tôi đã kiểm tra thông tin' }))
    expect(screen.queryByText(/Hãy tích/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi đăng ký' })).toBeEnabled()
  })

  it('opens a lightbox with the API image when a product image is tapped', async () => {
    const user = userEvent.setup()
    renderPage(stubSource(async () => student()), { skipIdentity: true })
    await user.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('button', { name: 'Phóng to ảnh Áo Blazer' }))
    const zoomed = within(screen.getByRole('dialog')).getByRole('img', { name: 'Áo Blazer' })
    expect(zoomed).toHaveAttribute('src', IMG.url)
    expect(zoomed).toHaveAttribute('width', '800')
  })

  it('keeps an order with several sizes of one product read-only', async () => {
    const order = {
      id: 'o',
      code: 'GB1',
      status: 'SUBMITTED',
      total: 800000,
      has_unpriced: false,
      submitted_at: '2026-10-02T00:00:00Z',
      kit_lines: [],
      item_lines: [
        { product_id: 'p-blazer', size_label: '2', colour: 'ghi', qty: 1 },
        { product_id: 'p-blazer', size_label: '3', colour: 'ghi', qty: 1 },
      ],
    }
    renderPage(stubSource(async () => student(), async () => ordering({ order })), { skipIdentity: true })
    expect(await screen.findByText('Đơn có nhiều cỡ cho một sản phẩm, liên hệ Giabaco để đổi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi lựa chọn' })).not.toBeInTheDocument()
  })

  it('preselects the size-chart suggestion with a badge', async () => {
    const user = userEvent.setup()
    const o = ordering()
    renderPage(stubSource(async () => student({ data_source: 'PARENT_DECLARED', suggested_sizes: { blazer: '3' } }), async () => o), {
      skipIdentity: true,
    })
    await user.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng Áo Blazer' }))
    expect(screen.getByRole('radio', { name: 'Cỡ 3 Gợi ý theo bảng cỡ' })).toBeChecked()
  })
})
