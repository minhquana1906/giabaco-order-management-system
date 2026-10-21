import { formatNumber, formatVnd } from '@/lib/format'
import { readableOn } from '@/lib/sizes'
import type { CampaignOverview, CampaignPivot, PivotCounts, PivotGroup, PivotMeasure } from './api'
import type { GenderFilter } from './dashboardSearch'

export const MEASURES = [
  { value: 'qty', label: 'Số lượng (cái)' },
  { value: 'orders', label: 'Số học sinh đặt' },
  { value: 'amount', label: 'Thành tiền' },
] as const satisfies readonly { value: PivotMeasure; label: string }[]

export const MEASURE_CAPTION: Record<PivotMeasure, string> = {
  qty: 'Mỗi ô: số cái đặt theo cỡ',
  orders: 'Mỗi ô: số học sinh đặt sản phẩm này ở cỡ này',
  amount: 'Mỗi ô: thành tiền theo giá trong đợt',
}

export const GENDERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
] as const satisfies readonly { value: GenderFilter; label: string }[]

export const GROUPS = [
  { value: 'product', label: 'Theo sản phẩm' },
  { value: 'kit', label: 'Theo bộ' },
  { value: 'class', label: 'Theo lớp' },
] as const satisfies readonly { value: PivotGroup; label: string }[]

export const ZERO_MARK = '·'
export const UNPRICED_MARK = '—'

export const resolveGroup = (group: PivotGroup, kitCount: number): PivotGroup =>
  group === 'kit' && kitCount === 0 ? 'product' : group

export function amountKpi(o: Pick<CampaignOverview, 'amount' | 'priced_items' | 'unpriced_items'>) {
  if (o.priced_items === 0) return { value: 'Chưa có giá', note: undefined }
  return {
    value: formatVnd(o.amount),
    note: o.unpriced_items > 0 ? `${formatNumber(o.unpriced_items)} món chưa có giá` : 'Chưa thanh toán',
  }
}

export const unpricedBannerText = (count: number) =>
  `${formatNumber(count)} món chưa có giá — cập nhật giá trong Đợt đăng ký`

export const progressMeterFill = (done: number, total: number) =>
  total > 0 ? Math.round((Math.min(done, total) / total) * 10) : 0

export interface MatrixCell {
  value: number
  unpriced: boolean
}

export interface MatrixRow {
  id: string
  name: string
  orders: number
  cells: MatrixCell[]
  total: MatrixCell
}

export interface Matrix {
  sizes: string[]
  rows: MatrixRow[]
  footer: Omit<MatrixRow, 'id' | 'name' | 'orders'>
  max: number
}

const pick = (counts: PivotCounts, gender: GenderFilter) =>
  gender === 'male' ? counts.male : gender === 'female' ? counts.female : counts.total

const toCell = (value: number, qty: number, unpriced: number, measure: PivotMeasure): MatrixCell => ({
  value,
  unpriced: measure === 'amount' && qty > 0 && unpriced === qty,
})

export function buildMatrix(pivot: CampaignPivot, measure: PivotMeasure, gender: GenderFilter): Matrix {
  const sums = pivot.sizes.map(() => ({ value: 0, qty: 0, unpriced: 0 }))
  const grand = { value: 0, qty: 0, unpriced: 0 }
  let max = 0

  const rows = pivot.blocks.map((block): MatrixRow => {
    const bySize = new Map(block.rows.map((r) => [r.size_label, r]))
    const cells = pivot.sizes.map((size, i) => {
      const row = bySize.get(size)
      const value = row ? pick(row, gender) : 0
      const qty = row ? pick(row.qty, gender) : 0
      const unpriced = row ? pick(row.unpriced_qty, gender) : 0
      const sum = sums[i]!
      sum.value += value
      sum.qty += qty
      sum.unpriced += unpriced
      max = Math.max(max, value)
      return toCell(value, qty, unpriced, measure)
    })
    const value = pick(block.totals, gender)
    const qty = pick(block.totals.qty, gender)
    const unpriced = pick(block.totals.unpriced_qty, gender)
    grand.value += value
    grand.qty += qty
    grand.unpriced += unpriced
    return { id: block.id, name: block.name, orders: block.orders, cells, total: toCell(value, qty, unpriced, measure) }
  })

  return {
    sizes: pivot.sizes,
    rows,
    footer: {
      cells: sums.map((s) => toCell(s.value, s.qty, s.unpriced, measure)),
      total: toCell(grand.value, grand.qty, grand.unpriced, measure),
    },
    max,
  }
}

export function formatCell(cell: MatrixCell): string {
  if (cell.unpriced) return UNPRICED_MARK
  return cell.value === 0 ? ZERO_MARK : formatNumber(cell.value)
}

const NAVY = [0x1b, 0x2b, 0x4b] as const

export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0
  return 0.1 + Math.min(1, value / max) * 0.72
}

export function heatStyle(value: number, max: number): { backgroundColor: string; color: string } | undefined {
  const t = heatLevel(value, max)
  if (t === 0) return undefined
  const hex = NAVY.map((c) => Math.round(255 + (c - 255) * t).toString(16).padStart(2, '0')).join('')
  const backgroundColor = `#${hex}`
  return { backgroundColor, color: readableOn(backgroundColor) }
}
