import type { LinesPayload, OrderDetail, OrderGender, OrderHistory, OrderLine, OrderSource, OrderStatus } from './api'
import type { TailorLine } from '@/features/parent_portal/api'

export const STATUS_LABEL: Record<OrderStatus, string> = { DRAFT: 'Nháp', SUBMITTED: 'Đã gửi' }
export const SOURCE_LABEL: Record<OrderSource, string> = {
  PARENT: 'Phụ huynh',
  STAFF: 'Nhân viên',
  LEGACY_IMPORT: 'Dữ liệu cũ',
}
export const GENDER_LABEL: Record<OrderGender, string> = { MALE: 'Nam', FEMALE: 'Nữ' }
export const genderText = (gender: OrderGender | null) => (gender ? GENDER_LABEL[gender] : 'Chưa rõ')

const ACTION_LABEL: Record<string, string> = {
  'order.create': 'Tạo đơn',
  'order.lines.replace': 'Sửa dòng đơn',
  'order.update': 'Sửa thông tin đơn',
}
export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action

export type SizeEdits = Record<string, string>

export function effectiveSize(line: OrderLine, edits: SizeEdits): string {
  return edits[line.id] ?? line.size_label
}

export function isDirty(order: OrderDetail, edits: SizeEdits): boolean {
  return order.lines.some((line) => effectiveSize(line, edits) !== line.size_label)
}

export function buildLinesPayload(order: OrderDetail, edits: SizeEdits, submit = false, tailorEdits: Record<string, TailorLine> = {}): LinesPayload {
  return {
    kit_lines: order.kit_lines.map((kitLine) => ({
      kit_id: kitLine.kit_id,
      qty: kitLine.qty,
      slots: order.lines
        .filter((line) => line.kit_line_id === kitLine.id && line.slot_id)
        .map((line) => ({
          slot_id: line.slot_id as string,
          product_id: line.product_id,
          size_label: effectiveSize(line, edits),
          colour: line.colour,
          line_id: line.id,
          is_tailor: tailorEdits[line.id]?.is_tailor ?? line.is_tailor ?? false,
          measurements: (tailorEdits[line.id]?.is_tailor ?? line.is_tailor) ? (tailorEdits[line.id]?.measurements ?? line.measurements ?? {}) : {},
          note: tailorEdits[line.id]?.note ?? (tailorEdits[line.id] ? null : (line.note ?? null)),
        })),
    })),
    item_lines: order.lines
      .filter((line) => line.kit_line_id === null)
      .map((line) => ({
        product_id: line.product_id,
        size_label: effectiveSize(line, edits),
        qty: line.qty,
        colour: line.colour,
        line_id: line.id,
        is_tailor: tailorEdits[line.id]?.is_tailor ?? line.is_tailor ?? false,
        measurements: (tailorEdits[line.id]?.is_tailor ?? line.is_tailor) ? (tailorEdits[line.id]?.measurements ?? line.measurements ?? {}) : {},
        note: tailorEdits[line.id]?.note ?? (tailorEdits[line.id] ? null : (line.note ?? null)),
      })),
    submit,
  }
}

interface SnapshotLine {
  product_id: string
  size_label: string
  colour: string
  qty: number
}

const linesOf = (snapshot: Record<string, unknown> | null): SnapshotLine[] | null =>
  snapshot && Array.isArray(snapshot.lines) ? (snapshot.lines as SnapshotLine[]) : null

export function describeHistory(entry: OrderHistory, productNames: Record<string, string>): string[] {
  if (entry.action !== 'order.lines.replace') return []
  const before = linesOf(entry.before)
  const after = linesOf(entry.after)
  if (!before || !after) return []
  if (before.length === 0) return [`Thêm ${after.length} dòng`]
  if (before.length !== after.length) return [`Số dòng ${before.length} → ${after.length}`]
  const changes: string[] = []
  before.forEach((was, index) => {
    const now = after[index]
    if (!now) return
    const name = productNames[now.product_id] ?? 'Sản phẩm'
    if (was.product_id !== now.product_id) changes.push('Đổi sản phẩm')
    else {
      if (was.size_label !== now.size_label) changes.push(`${name}: cỡ ${was.size_label} → ${now.size_label}`)
      if (was.qty !== now.qty) changes.push(`${name}: số lượng ${was.qty} → ${now.qty}`)
    }
  })
  return changes
}
