import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { productionApi, type Assignment } from './api'
import { FacilityProductionPage } from './FacilityProductionPage'

const assignment: Assignment = {
  id: 'a1', campaign_id: 'c1', campaign_name: 'Đợt thu 2026', step_position: 6, step_name: 'May', facility_id: 'f1', facility_name: 'Đối tác 1', assignee: null, step_mode: 'partners',
  product_id: 'p1', product_name: 'Áo sơ mi', quantity: 40, deadline: null, step_deadline: '2026-10-09', effective_deadline: '2026-10-09', overdue: true,
  status: 'pending', content: null, actual_at: null,
  history: [{ id: 'h1', at: '2026-10-09T03:00:00Z', actor: 'production_staff:x', status: 'in_progress', content: 'Đã cắt vải', actual_at: null, deadline: null }],
}

function show(assignments: Assignment[]) {
  vi.spyOn(productionApi, 'me').mockResolvedValue({ role: 'facility', facility_id: 'f1' })
  vi.spyOn(productionApi, 'assignments').mockResolvedValue(assignments)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><FacilityProductionPage onLogout={() => {}} /></QueryClientProvider>)
}

afterEach(() => vi.restoreAllMocks())

describe('facility assignments', () => {
  it('saves progress of an assignment grouped by campaign and step', async () => {
    const update = vi.spyOn(productionApi, 'updateProgress').mockResolvedValue(assignment)
    show([assignment])
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: 'Đợt thu 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'May' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đối tác 1' })).toBeInTheDocument()
    expect(screen.getAllByText('Quá hạn')).toHaveLength(2)
    expect(screen.getByText('Hạn: 09/10/2026')).toBeInTheDocument()
    expect(screen.queryByLabelText(/hạn/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cập nhật tiến độ' }))
    expect(screen.queryByText(/Đã cắt vải/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lịch sử cập nhật' }))
    expect(screen.getByText(/Đã cắt vải/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu cập nhật' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'completed')
    await user.type(screen.getByLabelText('Nội dung'), 'Hoàn tất')
    await user.type(screen.getByLabelText('Ngày giờ thực tế'), '2026-10-10T14:30')
    await user.click(screen.getByRole('button', { name: 'Lưu cập nhật' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { status: 'completed', content: 'Hoàn tất', actual_at: new Date('2026-10-10T14:30').toISOString() }))
  })

  it('shows an empty state when nothing is assigned', async () => {
    show([])
    expect(await screen.findByText('Chưa có công việc nào được giao.')).toBeInTheDocument()
  })
})
