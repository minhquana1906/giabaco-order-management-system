import { describe, expect, it } from 'vitest'
import type { OrderDetail, OrderHistory, OrderLine } from './api'
import { buildLinesPayload, describeHistory, isDirty } from './logic'

const line = (over: Partial<OrderLine>): OrderLine => ({
  id: 'l1',
  kit_line_id: null,
  slot_id: null,
  slot_label: null,
  product_id: 'p1',
  product_name: 'Sơ mi',
  sizes: ['3', '4', '5'],
  colours: ['ghi'],
  size_label: '3',
  colour: 'ghi',
  qty: 1,
  unit_price: 100_000,
  ...over,
})

const order = {
  kit_lines: [{ id: 'k1', kit_id: 'kit', kit_name: 'Bộ hè', qty: 2 }],
  lines: [
    line({ id: 'a', kit_line_id: 'k1', slot_id: 's1', product_id: 'shirt', qty: 2 }),
    line({ id: 'b', kit_line_id: 'k1', slot_id: 's2', product_id: 'skirt', qty: 2 }),
    line({ id: 'c', product_id: 'jacket', size_label: '4' }),
  ],
} as OrderDetail

describe('buildLinesPayload', () => {
  it('keeps kit qty and sends one slot pick per kit line with the edited size', () => {
    const payload = buildLinesPayload(order, { b: '5' })
    expect(payload.kit_lines).toMatchObject([
      {
        kit_id: 'kit',
        qty: 2,
        slots: [
          { slot_id: 's1', product_id: 'shirt', size_label: '3' },
          { slot_id: 's2', product_id: 'skirt', size_label: '5' },
        ],
      },
    ])
    expect(payload.item_lines).toMatchObject([{ product_id: 'jacket', size_label: '4', qty: 1, colour: 'ghi' }])
    expect(payload.submit).toBe(false)
  })

  it('preserves tailor data and line identity when changing another line', () => {
    const tailored = { ...order, lines: [line({ is_tailor: true, measurements: { chest: 72 }, note: 'Rộng' })] }
    expect(buildLinesPayload(tailored, {}).item_lines[0]).toMatchObject({
      line_id: 'l1', is_tailor: true, measurements: { chest: 72 }, note: 'Rộng',
    })
  })

  it('reports dirty only when a size differs', () => {
    expect(isDirty(order, {})).toBe(false)
    expect(isDirty(order, { c: '4' })).toBe(false)
    expect(isDirty(order, { c: '5' })).toBe(true)
  })
})

describe('describeHistory', () => {
  const snap = (size: string) => ({ lines: [{ product_id: 'jacket', size_label: size, colour: 'ghi', qty: 1 }] })
  const entry = (before: unknown, after: unknown): OrderHistory => ({
    at: '',
    actor: 'admin',
    action: 'order.lines.replace',
    before: before as OrderHistory['before'],
    after: after as OrderHistory['after'],
  })

  it('names the size change', () => {
    expect(describeHistory(entry(snap('4'), snap('5')), { jacket: 'Áo khoác' })).toEqual(['Áo khoác: cỡ 4 → 5'])
  })

  it('reports added lines and ignores other actions', () => {
    expect(describeHistory(entry({ lines: [] }, snap('4')), {})).toEqual(['Thêm 1 dòng'])
    expect(describeHistory({ ...entry(null, null), action: 'order.update' }, {})).toEqual([])
  })
})
