import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MasterDataPage } from './MasterDataPage'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const definitions = {
  facilities: {
    fields: ['Mã cơ sở', 'Tên cơ sở/đối tác', 'Nhóm sản phẩm', 'Công đoạn chính', 'Trạng thái hợp tác'],
    required: ['Mã cơ sở'],
    conditional_required: [],
  },
  materials: {
    fields: ['Mã NPL', 'Tên NPL', 'Nhóm NPL', 'Lead time', 'Trạng thái phê duyệt', 'Ghi chú'],
    required: ['Mã NPL', 'Tên NPL', 'Lead time'],
    conditional_required: [],
  },
  suppliers: { fields: ['Mã NCC', 'Tên NCC/Đối tác'], required: ['Mã NCC'], conditional_required: [] },
  products: { fields: ['Mã SP nền', 'Tên sản phẩm'], required: ['Mã SP nền'], conditional_required: [] },
}
const complete = {
  id: 'r1',
  data: { 'Mã NPL': 'NPL-1', 'Tên NPL': 'Vải A', 'Lead time': '7 ngày' },
  missing_fields: [],
}
const partial = {
  id: 'r2',
  data: { 'Mã NPL': 'NPL-2', 'Tên NPL': 'Cúc B' },
  missing_fields: ['Lead time'],
}

function stub() {
  const calls: { method: string; path: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://x').pathname
      const method = init?.method ?? 'GET'
      calls.push({ method, path })
      if (path === '/api/master-data/definitions') return json(definitions)
      if (path === '/api/master-data/summary') {
        return json({
          facilities: { total: 0, needs_attention: 0 },
          materials: { total: 2, needs_attention: 1 },
          suppliers: { total: 0, needs_attention: 0 },
          products: { total: 0, needs_attention: 0 },
        })
      }
      if (path === '/api/master-data/facilities' && method === 'GET') {
        return json([
          {
            id: 'f1',
            data: { 'Mã cơ sở': 'GUF-FOB-001', 'Tên cơ sở/đối tác': 'An Dương', 'Công đoạn chính': 'May/lắp ráp', 'Trạng thái hợp tác': 'Tạm dừng/Không ưu tiên hợp tác' },
            missing_fields: [],
          },
        ])
      }
      if (path === '/api/production/facilities/f1/staff') return json([])
      if (path === '/api/master-data/materials' && method === 'GET') return json([complete, partial])
      if (path === '/api/master-data/materials/r2' && method === 'DELETE') return new Response(null, { status: 204 })
      return json({}, 404)
    }),
  )
  return calls
}

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MasterDataPage />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(await screen.findByRole('tab', { name: /Nguyên phụ liệu/ }))
  await screen.findByRole('table')
  return user
}

afterEach(() => vi.unstubAllGlobals())

it('shows kind tabs with counts and flags incomplete records', async () => {
  stub()
  await renderPage()
  expect(screen.getByRole('tab', { name: /Cơ sở sản xuất\s*0/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Nguyên phụ liệu\s*2\s*1\s*hồ sơ cần bổ sung/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Nhà cung cấp\s*0/ })).toBeInTheDocument()
  const table = screen.getByRole('table')
  const row = within(table).getByText('NPL-2').closest('tr') as HTMLElement
  expect(within(row).getByText('Cần bổ sung 1 mục')).toBeInTheDocument()
  expect(within(within(table).getByText('NPL-1').closest('tr') as HTMLElement).getByText('Đầy đủ')).toBeInTheDocument()
})

it('searches only code, name and group, and filters records needing attention', async () => {
  stub()
  const user = await renderPage()
  const search = screen.getByRole('searchbox', { name: 'Tìm hồ sơ' })
  await user.type(search, '7 ngay')
  expect(await screen.findByText('Không có hồ sơ phù hợp')).toBeInTheDocument()
  await user.clear(search)
  await user.type(search, 'vai a')
  expect(within(screen.getByRole('table')).getByText('NPL-1')).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Chỉ hồ sơ cần bổ sung' }))
  expect(await screen.findByText('Không có hồ sơ phù hợp')).toBeInTheDocument()
})

it('opens the editable record when its row is clicked', async () => {
  stub()
  const user = await renderPage()
  await user.click(within(screen.getByRole('table')).getByText('Cúc B'))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getAllByText('Cần bổ sung')).toHaveLength(1)
  expect(within(sheet).getByLabelText('Thời gian giao hàng')).toHaveAccessibleDescription('Cần bổ sung')
  expect(within(sheet).getByRole('textbox', { name: 'Ghi chú' })).not.toHaveAccessibleDescription()
  expect(within(sheet).getByLabelText('Mã nguyên phụ liệu')).toBeDisabled()
})

it('shows fields missing from every section under "Khác"', async () => {
  stub()
  definitions.materials.fields.push('Trường mới')
  const user = await renderPage()
  await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'NPL-2' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByRole('textbox', { name: 'Trường mới' })).toBeInTheDocument()
  definitions.materials.fields.pop()
})

it('deletes from the record sheet after confirming', async () => {
  const calls = stub()
  const user = await renderPage()
  await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'NPL-2' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xóa hồ sơ' }))
  const confirm = await screen.findByRole('dialog', { name: 'Xóa hồ sơ?' })
  expect(within(confirm).getByText(/NPL-2 \(Cúc B\)/)).toBeInTheDocument()
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  await user.click(within(confirm).getByRole('button', { name: 'Xóa hồ sơ' }))
  await vi.waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/api/master-data/materials/r2' }))
})

it('shows the main stage column between product group and cooperation status', async () => {
  stub()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MasterDataPage />
    </QueryClientProvider>,
  )
  const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
    'Mã cơ sở', 'Tên cơ sở hoặc đối tác', 'Nhóm sản phẩm', 'Công đoạn chính', 'Trạng thái hợp tác', 'Hồ sơ',
  ])
  expect(within(within(table).getByText('GUF-FOB-001').closest('tr') as HTMLElement).getByText('May/lắp ráp')).toBeInTheDocument()
})

it('offers fixed cooperation statuses and keeps an imported one', async () => {
  stub()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MasterDataPage />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(within(await screen.findByRole('table')).getByRole('button', { name: 'GUF-FOB-001' }))
  const status = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Trạng thái hợp tác' })
  expect(status).toHaveValue('Tạm dừng/Không ưu tiên hợp tác')
  expect(within(status).getAllByRole('option').map((option) => option.textContent)).toEqual([
    'Chưa chọn',
    'Đang sử dụng',
    'Đang đánh giá',
    'Tạm dừng',
    'Ngưng',
    'Tạm dừng/Không ưu tiên hợp tác',
  ])
  expect(await screen.findByText('Đối tác này chưa có tài khoản. Tạo tài khoản bên dưới.')).toBeInTheDocument()
})
