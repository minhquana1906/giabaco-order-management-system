import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { campaignsApi } from '@/features/campaigns/api'
import { productionApi, type Assignment, type Progress } from './api'
import { AdminProductionPage } from './AdminProductionPage'

const assigned: Assignment = {
  id: 'a1', campaign_id: 'c1', campaign_name: 'Đợt 1', step_position: 6, step_name: 'May', facility_id: 'f1', facility_name: 'Xưởng An', assignee: null, step_mode: 'partners',
  product_id: 'p1', product_name: 'Áo sơ mi', quantity: 30, deadline: null, step_deadline: null, effective_deadline: null, overdue: false,
  status: 'in_progress', content: null, actual_at: null, history: [],
}

const progress: Progress = {
  campaign: { id: 'c1', name: 'Đợt 1', status: 'OPEN', closes_at: '2026-10-20T00:00:00+07:00', submitted_orders: 12 },
  steps: Array.from({ length: 10 }, (_, i) => ({ position: i + 1, name: `Bước số ${i + 1}`, deadline: null, mode: 'partners' as const, state: i === 5 ? 'in_progress' as const : 'unassigned' as const, overdue: false, assignments: i === 5 ? [assigned] : [] })),
  demand: [{ product_id: 'p1', product_name: 'Áo sơ mi', ordered_qty: 100 }, { product_id: 'p2', product_name: 'Quần dài', ordered_qty: 20 }],
}

function show(data: Progress = progress) {
  vi.spyOn(campaignsApi, 'list').mockResolvedValue([
    { id: 'c2', school_id: 's', name: 'Đợt 2', school_year: '2026-2027', opens_at: '2026-09-01', closes_at: null, status: 'OPEN', updated_at: '', item_count: 0, kit_count: 0 },
    { id: 'c1', school_id: 's', name: 'Đợt 1', school_year: '2026-2027', opens_at: '2026-01-01', closes_at: null, status: 'OPEN', updated_at: '', item_count: 0, kit_count: 0 },
  ])
  vi.spyOn(productionApi, 'progress').mockResolvedValue(data)
  vi.spyOn(productionApi, 'facilities').mockResolvedValue([{ id: 'f1', code: 'F1', name: 'Xưởng An', active: true, main_stage: null }, { id: 'f2', code: 'F2', name: 'Xưởng Bình', active: true, main_stage: null }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><AdminProductionPage /></QueryClientProvider>)
}

afterEach(() => vi.restoreAllMocks())

describe('admin production progress', () => {
  it('defaults to the newest campaign with collapsed steps, lists only assigned products and prefills the quantity when adding a partner', async () => {
    const create = vi.spyOn(productionApi, 'createAssignment').mockResolvedValue(assigned)
    show()
    const user = userEvent.setup()
    expect(await screen.findByLabelText('Đợt')).toHaveValue('c2')
    expect(await screen.findByRole('button', { name: /6\. Bước số 6/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: /Chi tiết bước/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /6\. Bước số 6/ }))
    const panel = await screen.findByRole('region', { name: 'Chi tiết bước 6' })
    const rows = within(panel).getAllByRole('row').map((row) => within(row).queryAllByRole('cell').map((cell) => cell.textContent))
    expect(rows).toContainEqual(['Áo sơ mi', '100', '30', '70'])
    expect(rows.flat()).not.toContain('Quần dài')
    expect(within(panel).getByLabelText('Đối tác', { selector: '#add-6-facility' })).toHaveValue('f1')
    await user.selectOptions(within(panel).getByLabelText('Thêm sản phẩm vào bảng'), 'p2')
    await user.click(within(panel).getByRole('button', { name: 'Bỏ Quần dài khỏi bảng' }))
    expect(within(panel).queryByRole('button', { name: 'Bỏ Quần dài khỏi bảng' })).not.toBeInTheDocument()
    expect(within(within(panel).getByLabelText('Thêm sản phẩm vào bảng')).getByRole('option', { name: 'Quần dài' })).toBeInTheDocument()
    await user.selectOptions(within(panel).getByLabelText('Thêm sản phẩm vào bảng'), 'p2')
    await user.selectOptions(within(panel).getByLabelText('Đối tác', { selector: '#add-6-facility' }), 'f2')
    await user.selectOptions(within(panel).getByLabelText('Sản phẩm', { selector: '#add-6-product' }), 'p2')
    expect(within(panel).getByLabelText('Số lượng', { selector: '#add-6-quantity' })).toHaveValue(20)
    await user.click(within(panel).getByRole('button', { name: 'Thêm đối tác' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ campaign_id: 'c2', step_position: 6, facility_id: 'f2', product_id: 'p2', quantity: 20, deadline: null }))
  })

  it('keeps one step expanded at a time and shows order context on step 4', async () => {
    show()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /6\. Bước số 6/ }))
    await screen.findByRole('region', { name: 'Chi tiết bước 6' })
    await user.click(screen.getByRole('button', { name: /4\. Bước số 4/ }))
    expect(screen.queryByRole('region', { name: 'Chi tiết bước 6' })).not.toBeInTheDocument()
    expect(screen.getByText('12 đơn đã nộp · Đợt đang mở · Hạn đóng đợt 20/10/2026')).toBeInTheDocument()
  })

  it('switches a step to internal mode through the segmented control', async () => {
    const setMode = vi.spyOn(productionApi, 'setStepMode').mockResolvedValue({ position: 6, name: 'Bước số 6', deadline: null, mode: 'internal' })
    show()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /6\. Bước số 6/ }))
    const panel = await screen.findByRole('region', { name: 'Chi tiết bước 6' })
    expect(within(panel).getByRole('button', { name: 'Giao đối tác' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(panel).getByRole('button', { name: 'Nội bộ Giabaco' }))
    await waitFor(() => expect(setMode).toHaveBeenCalledWith('c2', 6, 'internal'))
  })

  it('creates the single internal record on first save', async () => {
    const create = vi.spyOn(productionApi, 'createAssignment').mockResolvedValue({ ...assigned, step_mode: 'internal' })
    show({ ...progress, steps: progress.steps.map((s) => s.position === 1 ? { ...s, mode: 'internal' as const } : s) })
    const user = userEvent.setup()
    expect(await screen.findByText('Nội bộ Giabaco')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /1\. Bước số 1/ }))
    const panel = await screen.findByRole('region', { name: 'Chi tiết bước 1' })
    expect(within(panel).queryByRole('button', { name: 'Thêm đối tác' })).not.toBeInTheDocument()
    await user.type(within(panel).getByLabelText('Người phụ trách'), 'Phòng Thiết kế')
    await user.selectOptions(within(panel).getByLabelText('Trạng thái'), 'in_progress')
    await user.click(within(panel).getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ campaign_id: 'c2', step_position: 1, assignee: 'Phòng Thiết kế', status: 'in_progress', deadline: null, actual_at: null, content: null }))
  })

  it('summarizes progress and shows the completion state with the latest actual date', async () => {
    const done = { ...assigned, status: 'completed' as const, actual_at: '2026-10-28T10:00:00+07:00' }
    show({ ...progress, steps: progress.steps.map((s) => ({ ...s, state: 'completed' as const, assignments: s.position === 10 ? [done] : [] })) })
    expect(await screen.findByText(/Đợt đã hoàn tất/)).toHaveTextContent('28/10/2026')
    expect(screen.queryByText(/Đã xong/)).not.toBeInTheDocument()
  })

  it('shows the current step and overdue count while unfinished', async () => {
    show({ ...progress, steps: progress.steps.map((s) => s.position === 1 ? { ...s, state: 'completed' as const } : s.position === 2 ? { ...s, overdue: true } : s) })
    expect(await screen.findByText('Đã xong 1/10 bước')).toBeInTheDocument()
    expect(screen.getByText('1 bước quá hạn')).toBeInTheDocument()
    expect(screen.getByText('Đang ở bước 2: Bước số 2')).toBeInTheDocument()
  })

  it('reconciles quantities on its tab', async () => {
    show()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'Đối soát số lượng' }))
    const rows = (await screen.findAllByRole('row')).map((row) => within(row).queryAllByRole('cell').map((cell) => cell.textContent))
    expect(rows).toContainEqual(['Áo sơ mi', '100', '0 / 30', '0 / 0', '0 / 0', '0 / 0'])
    expect(rows).toContainEqual(['Quần dài', '20', '0 / 0', '0 / 0', '0 / 0', '0 / 0'])
    expect(screen.getByText(/hoàn thành \/ phân công/)).toBeInTheDocument()
  })

  it('lists activity events newest first on its tab', async () => {
    vi.spyOn(productionApi, 'activity').mockResolvedValue([
      { id: 'e1', at: '2026-10-28T10:00:00+07:00', actor: 'production_staff:1', action: 'update_progress', step_position: 6, step_name: 'May', partner: 'Xưởng An', product_name: 'Áo sơ mi', status: 'completed', note: 'Xong lô 1' },
    ])
    show()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'Hoạt động' }))
    expect(await screen.findByText('Xưởng An cập nhật bước 6 · Áo sơ mi → Hoàn thành')).toBeInTheDocument()
    expect(screen.getByText('Xong lô 1')).toBeInTheDocument()
  })
})
