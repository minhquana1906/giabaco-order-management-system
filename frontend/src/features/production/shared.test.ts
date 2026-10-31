import { describe, expect, it } from 'vitest'
import type { Assignment, ProgressStep } from './api'
import { assignmentChanges, valuesOf } from './AssignmentForm'
import { auditChanges, demandRows, listedDemandRows, reconcileRows, wideCoverage } from './shared'

const assignment = (over: Partial<Assignment>): Assignment => ({
  id: 'a', campaign_id: 'c', campaign_name: 'Đợt', step_position: 6, step_name: 'May', facility_id: 'f1', facility_name: 'Đối tác 1', assignee: null, step_mode: 'partners',
  product_id: 'p1', product_name: 'Áo', quantity: 10, deadline: null, step_deadline: null, effective_deadline: null, overdue: false,
  status: 'pending', content: null, actual_at: null, history: [], ...over,
})

describe('auditChanges', () => {
  it('lists only changed fields with Vietnamese labels and values', () => {
    const before = { status: 'pending', deadline: null, content: null, actual_at: null }
    const after = { status: 'in_progress', deadline: '2026-11-01', content: 'Đã cắt vải', actual_at: null }
    expect(auditChanges(before, after).map((c) => `${c.label}: ${c.from} → ${c.to}`)).toEqual([
      'Hạn: Chưa đặt → 01/11/2026',
      'Trạng thái: Chưa bắt đầu → Đang thực hiện',
      'Nội dung: — → Đã cắt vải',
    ])
  })

  it('shows created fields without a before value and hides raw ids', () => {
    const changes = auditChanges(null, { campaign_id: 'x', product_id: 'y', facility_id: 'z', quantity: 12, deadline: null })
    expect(changes.map((c) => [c.label, c.from, c.to])).toEqual([['Số lượng', null, '12'], ['Hạn', null, 'Chưa đặt']])
  })

  it('reduces changed ids to a notice', () => {
    const changes = auditChanges({ facility_id: 'a', product_id: 'p' }, { facility_id: 'b', product_id: 'p' })
    expect(changes.map((c) => [c.label, c.from, c.to])).toEqual([['Đối tác', null, 'đã đổi đối tác']])
  })
})

describe('demandRows', () => {
  it('subtracts per-product assignments, ignores whole-campaign ones and flags over-assignment', () => {
    const demand = [{ product_id: 'p1', product_name: 'Áo', ordered_qty: 100 }, { product_id: 'p2', product_name: 'Quần', ordered_qty: 20 }]
    const rows = demandRows(demand, [assignment({ id: '1', quantity: 60 }), assignment({ id: '2', quantity: 15 }), assignment({ id: '3', product_id: null, quantity: 500 }), assignment({ id: '4', product_id: 'p2', quantity: 25 })])
    expect(rows.map((r) => [r.product_id, r.needed, r.assigned, r.remaining])).toEqual([['p1', 100, 75, 25], ['p2', 20, 25, -5]])
  })
})

describe('assignmentChanges', () => {
  it('sends only changed fields and explicit nulls for cleared ones', () => {
    const a = assignment({ quantity: 10, deadline: '2026-11-01' })
    expect(assignmentChanges(a, valuesOf(a))).toEqual({})
    expect(assignmentChanges(a, { ...valuesOf(a), product: '', quantity: '', deadline: '', status: 'completed', facility: 'f2' }))
      .toEqual({ facility_id: 'f2', product_id: null, quantity: null, deadline: null, status: 'completed' })
  })
})

describe('listedDemandRows', () => {
  it('keeps products with an assignment or explicitly added, drops the rest', () => {
    const demand = [{ product_id: 'p1', product_name: 'Áo', ordered_qty: 100 }, { product_id: 'p2', product_name: 'Quần', ordered_qty: 20 }, { product_id: 'p3', product_name: 'Váy', ordered_qty: 5 }]
    const assignments = [assignment({ product_id: 'p1' }), assignment({ id: 'x', product_id: null })]
    const rows = demandRows(demand, assignments)
    expect(listedDemandRows(rows, assignments, []).map((r) => r.product_id)).toEqual(['p1'])
    expect(listedDemandRows(rows, assignments, ['p3']).map((r) => r.product_id)).toEqual(['p1', 'p3'])
  })
})

describe('reconcileRows', () => {
  const step = (position: number, assignments: Assignment[]): ProgressStep => ({ position, name: 's', deadline: null, mode: 'partners', state: 'in_progress', overdue: false, assignments })
  const demand = [{ product_id: 'p1', product_name: 'Áo', ordered_qty: 100 }, { product_id: 'p2', product_name: 'Quần', ordered_qty: 0 }, { product_id: 'p3', product_name: 'Váy', ordered_qty: 5 }]

  it('sums completed/assigned per stage, flags shortfall and excess, hides untouched zero-order products', () => {
    const rows = reconcileRows(demand, [
      step(6, [assignment({ id: '1', quantity: 60, status: 'completed' }), assignment({ id: '2', quantity: 30, status: 'completed' })]),
      step(7, [assignment({ id: '3', quantity: 120, status: 'in_progress' })]),
      step(8, [assignment({ id: '4', quantity: 40, status: 'completed' })]),
      step(9, [assignment({ id: '5', quantity: 40, status: 'pending' })]),
    ])
    expect(rows.map((r) => r.product_id)).toEqual(['p1', 'p3'])
    expect(rows[0]!.cells).toEqual([
      { completed: 90, assigned: 90, tone: 'short' },
      { completed: 0, assigned: 120, tone: 'over' },
      { completed: 40, assigned: 40, tone: 'short' },
      { completed: 0, assigned: 40, tone: 'none' },
    ])
  })
})

describe('wideCoverage', () => {
  it('counts campaign-wide assignments per stage and ignores product-scoped ones', () => {
    const step = (position: number, assignments: Assignment[]): ProgressStep => ({ position, name: 's', deadline: null, mode: 'partners', state: 'in_progress', overdue: false, assignments })
    const cells = wideCoverage([
      step(7, [assignment({ id: '1', product_id: null, status: 'completed' }), assignment({ id: '2', product_id: null, status: 'pending' }), assignment({ id: '3', product_id: 'p1' })]),
    ])
    expect(cells).toEqual([{ assigned: 0, completed: 0 }, { assigned: 2, completed: 1 }, { assigned: 0, completed: 0 }, { assigned: 0, completed: 0 }])
  })
})
