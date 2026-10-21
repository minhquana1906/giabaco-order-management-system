import { describe, expect, it } from 'vitest'
import type { CampaignPivot, PivotBlock } from './api'
import {
  amountKpi,
  buildMatrix,
  formatCell,
  heatLevel,
  heatStyle,
  progressMeterFill,
  resolveGroup,
  unpricedBannerText,
} from './pivotLogic'

type Cell = [male: number, female: number, unpriced?: [number, number]]

const split = (male: number, female: number) => ({ male, female, unknown: 0, total: male + female })

const counts = (male: number, female: number, [um, uf]: [number, number] = [0, 0]) => ({
  ...split(male, female),
  qty: split(male, female),
  unpriced_qty: split(um, uf),
})

const block = (id: string, rows: Record<string, Cell>): PivotBlock => {
  const list = Object.entries(rows).map(([size_label, [m, f, u]]) => ({ size_label, ...counts(m, f, u) }))
  const sum = (pick: (r: (typeof list)[number]) => number) => list.reduce((acc, r) => acc + pick(r), 0)
  return {
    id,
    name: id,
    orders: 4,
    rows: list,
    totals: counts(
      sum((r) => r.male),
      sum((r) => r.female),
      [sum((r) => r.unpriced_qty.male), sum((r) => r.unpriced_qty.female)],
    ),
  }
}

const pivot: CampaignPivot = {
  sizes: ['1', '2', '3'],
  blocks: [block('blazer', { '1': [1, 2], '2': [3, 0] }), block('gile', { '2': [0, 4], '3': [5, 1] })],
  grand_total: 16,
}

describe('buildMatrix', () => {
  it('lays blocks out as rows over the union of sizes and totals both axes', () => {
    const m = buildMatrix(pivot, 'qty', 'all')
    expect(m.rows.map((r) => r.cells.map((c) => c.value))).toEqual([
      [3, 3, 0],
      [0, 4, 6],
    ])
    expect(m.rows.map((r) => r.total.value)).toEqual([6, 10])
    expect(m.footer.cells.map((c) => c.value)).toEqual([3, 7, 6])
    expect(m.footer.total.value).toBe(16)
    expect(m.max).toBe(6)
  })

  it('filters by gender', () => {
    const male = buildMatrix(pivot, 'qty', 'male')
    expect(male.rows[0]!.cells.map((c) => c.value)).toEqual([1, 3, 0])
    expect(male.footer.total.value).toBe(9)
    expect(buildMatrix(pivot, 'qty', 'female').footer.total.value).toBe(7)
  })

  it('marks amount cells as unpriced only when every unit in them is unpriced', () => {
    const priced: CampaignPivot = {
      sizes: ['1', '2', '3'],
      blocks: [block('blazer', { '1': [3, 0, [3, 0]], '2': [5, 1, [1, 0]] })],
      grand_total: 9,
    }
    const m = buildMatrix(priced, 'amount', 'all')
    expect(m.rows[0]!.cells.map((c) => c.unpriced)).toEqual([true, false, false])
    expect(m.footer.cells.map((c) => c.unpriced)).toEqual([true, false, false])
    expect(m.rows[0]!.total.unpriced).toBe(false)
    expect(buildMatrix(priced, 'qty', 'all').rows[0]!.cells[0]!.unpriced).toBe(false)
  })

  it('judges unpriced per gender, so the other gender cannot flip a cell', () => {
    const mixed: CampaignPivot = {
      sizes: ['1'],
      blocks: [block('blazer', { '1': [2, 3, [2, 0]] })],
      grand_total: 5,
    }
    expect(buildMatrix(mixed, 'amount', 'male').rows[0]!.cells[0]!.unpriced).toBe(true)
    expect(buildMatrix(mixed, 'amount', 'female').rows[0]!.cells[0]!.unpriced).toBe(false)
    expect(buildMatrix(mixed, 'amount', 'all').rows[0]!.cells[0]!.unpriced).toBe(false)
    const none: CampaignPivot = { sizes: ['1'], blocks: [block('b', { '1': [0, 2, [0, 0]] })], grand_total: 2 }
    expect(buildMatrix(none, 'amount', 'male').rows[0]!.cells[0]!.unpriced).toBe(false)
  })

  it('returns an empty matrix for a pivot without blocks', () => {
    const m = buildMatrix({ sizes: ['1'], blocks: [], grand_total: 0 }, 'qty', 'all')
    expect(m.rows).toEqual([])
    expect(m.max).toBe(0)
    expect(m.footer.total.value).toBe(0)
  })
})

describe('cell formatting', () => {
  it('renders zero as a faint dot, unpriced as a dash and the rest as numbers', () => {
    expect(formatCell({ value: 0, unpriced: false })).toBe('·')
    expect(formatCell({ value: 0, unpriced: true })).toBe('—')
    expect(formatCell({ value: 1234, unpriced: false })).toBe('1.234')
  })
})

describe('heat', () => {
  it('has no shade for zero and scales to the table max', () => {
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(5, 0)).toBe(0)
    expect(heatLevel(10, 10)).toBeCloseTo(0.82)
    expect(heatLevel(1, 10)).toBeLessThan(heatLevel(9, 10))
    expect(heatStyle(0, 10)).toBeUndefined()
    expect(heatStyle(10, 10)).toEqual({ backgroundColor: '#44516b', color: '#ffffff' })
  })
})

describe('amountKpi', () => {
  it('shows "Chưa có giá" instead of 0 đ whenever nothing priced was ordered', () => {
    expect(amountKpi({ amount: 0, priced_items: 0, unpriced_items: 28 })).toEqual({
      value: 'Chưa có giá',
      note: undefined,
    })
    expect(amountKpi({ amount: 0, priced_items: 0, unpriced_items: 0 }).value).toBe('Chưa có giá')
  })

  it('shows the amount with the unpriced remainder', () => {
    expect(amountKpi({ amount: 1500000, priced_items: 10, unpriced_items: 3 })).toEqual({
      value: '1.500.000 đ',
      note: '3 món chưa có giá',
    })
  })

  it('words the banner with the count', () => {
    expect(unpricedBannerText(28)).toBe('28 món chưa có giá — cập nhật giá trong Đợt đăng ký')
  })
})

describe('progressMeterFill', () => {
  it('rounds the ratio onto ten buttons', () => {
    expect(progressMeterFill(17, 100)).toBe(2)
    expect(progressMeterFill(5, 0)).toBe(0)
    expect(progressMeterFill(120, 100)).toBe(10)
  })
})

describe('campaign and group defaults', () => {
  it('falls back from kits to products when the campaign has no kits', () => {
    expect(resolveGroup('kit', 0)).toBe('product')
    expect(resolveGroup('kit', 2)).toBe('kit')
    expect(resolveGroup('class', 0)).toBe('class')
  })
})
