import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http'
import { productionApi, type Assignment } from './api'
import { AssignmentRow } from './AssignmentRow'
import { productionKeys, useProductionWrite } from './shared'

const assignment: Assignment = {
  id: 'a1', campaign_id: 'c1', campaign_name: 'Đợt 1', step_position: 6, step_name: 'May', facility_id: 'f1', facility_name: 'Xưởng An', assignee: null, step_mode: 'partners',
  product_id: 'p1', product_name: 'Áo sơ mi', quantity: 30, deadline: null, step_deadline: null, effective_deadline: null, overdue: false,
  status: 'pending', content: null, actual_at: null, history: [],
}
const facilities = [{ id: 'f1', code: 'F1', name: 'Xưởng An', active: true, main_stage: null }]
const products = [{ id: 'p1', name: 'Áo sơ mi' }]

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

function show() {
  render(<QueryClientProvider client={newClient()}><ul><AssignmentRow assignment={assignment} facilities={facilities} products={products} /></ul></QueryClientProvider>)
}

afterEach(() => vi.restoreAllMocks())

describe('admin assignment row', () => {
  it('sends only the changed fields when editing', async () => {
    const update = vi.spyOn(productionApi, 'updateAssignment').mockResolvedValue(assignment)
    show()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sửa' }))
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Số lượng'))
    await user.type(screen.getByLabelText('Số lượng'), '25')
    await user.type(screen.getByLabelText('Nội dung'), 'Ưu tiên')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { quantity: 25, content: 'Ưu tiên' }))
  })

  it('deletes only after confirmation', async () => {
    const remove = vi.spyOn(productionApi, 'deleteAssignment').mockResolvedValue(undefined)
    show()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Hủy phân công' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Xác nhận hủy' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a1'))
  })

  it('shows the server message, or a generic one, when a save fails', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '')
    vi.spyOn(productionApi, 'updateAssignment').mockRejectedValueOnce(new ApiError(409, 'duplicate', 'Phân công này đã tồn tại.')).mockRejectedValueOnce(new Error('boom'))
    show()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sửa' }))
    await user.type(screen.getByLabelText('Nội dung'), 'a')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(error).toHaveBeenLastCalledWith('Phân công này đã tồn tại.'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(error).toHaveBeenLastCalledWith('Chưa lưu được thay đổi. Vui lòng thử lại sau ít phút.'))
  })
})

describe('useProductionWrite', () => {
  it('invalidates production data but not the session query', async () => {
    const client = newClient()
    client.setQueryData(productionKeys.me(), { role: 'facility', facility_id: 'f1' })
    client.setQueryData(['production', 'progress', 'c1'], {})
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useProductionWrite(async () => undefined), { wrapper })
    result.current.mutate(undefined)
    await waitFor(() => expect(client.getQueryState(['production', 'progress', 'c1'])?.isInvalidated).toBe(true))
    expect(client.getQueryState(productionKeys.me())?.isInvalidated).toBe(false)
  })
})
