import { formatVnd } from '@/lib/format'
import type {
  Colour,
  Img,
  ItemLine,
  Kit,
  KitLine,
  KitOption,
  Ordering,
  OrderLines,
  PublicStudent,
  PublicTrial,
  TailorLine,
  TailorMeasurement,
} from './api'

export const MAX_QTY = 10

export const PRICE_UNKNOWN = 'Giá đang cập nhật'

export const formatPrice = (price: number | null) => (price == null ? PRICE_UNKNOWN : formatVnd(price))

type SizedProduct = { code: string; sizes: string[] }

export function derivedSize(product: SizedProduct, trials: PublicTrial[]): string | null {
  let best = -1
  for (const t of trials) {
    if (t.product_code === product.code && t.fit === 'FITS') {
      best = Math.max(best, product.sizes.indexOf(t.size_label))
    }
  }
  return best >= 0 ? product.sizes[best]! : null
}

export type PortalStep = 'identity' | 'measure' | 'overview'

export function initialStep(hasOrder: boolean, skipIdentity: boolean): PortalStep {
  if (hasOrder) return 'overview'
  return skipIdentity ? 'measure' : 'identity'
}

export interface Suggestion {
  size: string
  source: 'trial' | 'chart'
}

export function suggestionFor(
  product: SizedProduct,
  student: Pick<PublicStudent, 'trials' | 'data_source' | 'suggested_sizes'>,
): Suggestion | null {
  const measured = derivedSize(product, student.trials)
  if (measured) return { size: measured, source: 'trial' }
  const chart = student.data_source === 'PARENT_DECLARED' ? student.suggested_sizes[product.code] : null
  return chart && product.sizes.includes(chart) ? { size: chart, source: 'chart' } : null
}

export interface SlotDraft extends TailorLine {
  productId: string | null
  size: string | null
  colour: string | null
}

export interface KitDraft {
  qty: number
  size: string | null
  slots: Record<string, SlotDraft>
}

export interface ItemDraft extends TailorLine {
  qty: number
  size: string | null
  colour: string | null
}

export interface Draft {
  kits: Record<string, KitDraft>
  items: Record<string, ItemDraft>
}


const tailorFields = (line: TailorLine | undefined): TailorLine => ({
  line_id: line?.line_id ?? null,
  is_tailor: line?.is_tailor ?? false,
  measurements: line?.measurements ?? {},
  tailor_measurements: line?.tailor_measurements,
  note: line?.note ?? null,
})

export const tailorConfig = (draft: TailorLine, config: TailorMeasurement[]) =>
  draft.line_id && draft.is_tailor && draft.tailor_measurements?.length ? draft.tailor_measurements : config

const tailorInvalid = (draft: TailorLine, config: TailorMeasurement[]) => {
  const fields = tailorConfig(draft, config)
  return fields.length === 0 || fields.some((field) => {
    const value = draft.measurements?.[field.key]
    return (field.required && value == null) || (value != null && (!Number.isFinite(value) || value <= 0 || value > 500))
  })
}

const tailorPayload = (draft: TailorLine) => ({
  line_id: draft.line_id ?? null,
  is_tailor: draft.is_tailor ?? false,
  measurements: draft.is_tailor ? (draft.measurements ?? {}) : {},
  note: draft.note?.trim() || null,
})
export const needsColourChoice = (colours: Colour[]) => colours.length > 1

const autoColour = (colours: Colour[]) => (colours.length === 1 ? colours[0]!.code : null)

const colourOf = (colours: Colour[], code: string | null): Colour | null =>
  code ? (colours.find((c) => c.code === code) ?? { code, label: code, hex: '#d4d4d8' }) : null

export function hasSplitLines(order: OrderLines): boolean {
  const unique = (keys: string[]) => new Set(keys).size < keys.length
  return unique(order.kit_lines.map((l) => l.kit_id)) || unique(order.item_lines.map((l) => l.product_id))
}

export const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(0, qty))

export const selectedOption = (slot: Kit['slots'][number], draft: SlotDraft | undefined): KitOption | undefined =>
  slot.options.find((o) => o.product_id === draft?.productId)

export const effectiveSlotSize = (kit: KitDraft, slot: SlotDraft | undefined) => slot?.size ?? kit.size

function defaultOption(options: KitOption[]): KitOption | undefined {
  return options.find((o) => o.suggested) ?? options[0]
}

function suggestedFor(option: SizedProduct | undefined, student: PublicStudent): string | null {
  return option ? (suggestionFor(option, student)?.size ?? null) : null
}

export function initialDraft(ordering: Ordering, student: PublicStudent): Draft {
  const saved = ordering.order
  const kits: Draft['kits'] = {}
  for (const kit of ordering.kits) {
    const line = saved?.kit_lines.find((l) => l.kit_id === kit.id)
    const firstOption = defaultOption(kit.slots[0]?.options ?? [])
    const slots: KitDraft['slots'] = {}
    for (const slot of kit.slots) {
      const savedSlot = line?.slots.find((s) => s.slot_id === slot.id)
      const option = slot.options.find((o) => o.product_id === savedSlot?.product_id) ?? defaultOption(slot.options)
      slots[slot.id] = {
        ...tailorFields(savedSlot),
        productId: option?.product_id ?? null,
        size: savedSlot && savedSlot.size_label !== line?.size_label ? savedSlot.size_label : null,
        colour: savedSlot?.colour ?? (option ? autoColour(option.colours) : null),
      }
    }
    kits[kit.id] = {
      qty: line?.qty ?? 0,
      size: line?.size_label ?? suggestedFor(firstOption, student),
      slots,
    }
  }
  const items: Draft['items'] = {}
  for (const item of ordering.items) {
    const line = saved?.item_lines.find((l) => l.product_id === item.product_id)
    items[item.product_id] = {
      ...tailorFields(line),
      qty: line?.qty ?? 0,
      size: line?.size_label ?? suggestedFor(item, student),
      colour: line?.colour ?? autoColour(item.colours),
    }
  }
  return { kits, items }
}

export function buildPayload(ordering: Pick<Ordering, 'kits' | 'items'>, draft: Draft): OrderLines {
  const kit_lines: KitLine[] = []
  for (const kit of ordering.kits) {
    const d = draft.kits[kit.id]
    if (!d || d.qty <= 0) continue
    const slots = kit.slots.flatMap((slot) => {
      const sd = d.slots[slot.id]
      const size = effectiveSlotSize(d, sd)
      return sd?.productId && (size || sd.is_tailor)
        ? [{ slot_id: slot.id, product_id: sd.productId, size_label: size ?? '', colour: sd.colour, ...tailorPayload(sd), tailor_measurements: tailorConfig(sd, selectedOption(slot, sd)?.tailor_measurements ?? []) }]
        : []
    })
    kit_lines.push({ kit_id: kit.id, qty: d.qty, size_label: d.size ?? '', slots })
  }
  const item_lines: ItemLine[] = []
  for (const item of ordering.items) {
    const d = draft.items[item.product_id]
    if (!d || d.qty <= 0 || (!d.size && !d.is_tailor)) continue
    item_lines.push({ product_id: item.product_id, size_label: d.size ?? '', colour: d.colour, qty: d.qty, ...tailorPayload(d), tailor_measurements: tailorConfig(d, item.tailor_measurements ?? []) })
  }
  return { kit_lines, item_lines }
}

export function draftProblems(ordering: Pick<Ordering, 'kits' | 'items'>, draft: Draft): string[] {
  const problems: string[] = []
  let any = false
  for (const kit of ordering.kits) {
    const d = draft.kits[kit.id]
    if (!d || d.qty <= 0) continue
    any = true
    if (!d.size && kit.slots.some((slot) => !d.slots[slot.id]?.is_tailor && !d.slots[slot.id]?.size)) problems.push(`kit:${kit.id}`)
    for (const slot of kit.slots) {
      const sd = d.slots[slot.id]
      const option = selectedOption(slot, sd)
      const size = effectiveSlotSize(d, sd)
      if (!option || !sd || (sd.is_tailor ? tailorInvalid(sd, option.tailor_measurements ?? []) : !size || !option.sizes.includes(size))) problems.push(`slot:${slot.id}`)
      else if (needsColourChoice(option.colours) && !sd.colour) problems.push(`slot-colour:${slot.id}`)
    }
  }
  for (const item of ordering.items) {
    const d = draft.items[item.product_id]
    if (!d || d.qty <= 0) continue
    any = true
    if (d.is_tailor ? tailorInvalid(d, item.tailor_measurements ?? []) : !d.size || !item.sizes.includes(d.size)) problems.push(`item:${item.product_id}`)
    else if (needsColourChoice(item.colours) && !d.colour) problems.push(`item-colour:${item.product_id}`)
  }
  if (!any) problems.push('empty')
  return problems
}

export interface Estimate {
  total: number
  hasUnpriced: boolean
}

export function estimateTotal(ordering: Pick<Ordering, 'kits' | 'items'>, lines: OrderLines): Estimate {
  let total = 0
  let hasUnpriced = false
  const add = (price: number | null, qty: number) => {
    if (price == null) hasUnpriced = true
    else total += price * qty
  }
  for (const line of lines.kit_lines) add(ordering.kits.find((k) => k.id === line.kit_id)?.price ?? null, line.qty)
  for (const line of lines.item_lines) add(ordering.items.find((i) => i.product_id === line.product_id)?.price ?? null, line.qty)
  return { total, hasUnpriced }
}

export interface ReviewRow {
  key: string
  name: string
  image: Img | null
  qty: number
  size: string
  colour: Colour | null
  unitPrice: number | null
  amount: number | null
  tailor?: TailorLine
  parts: { label: string; name: string; size: string; colour: Colour | null; tailor: TailorLine }[]
}

export function reviewRows(ordering: Pick<Ordering, 'kits' | 'items'>, lines: OrderLines): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (const line of lines.kit_lines) {
    const kit = ordering.kits.find((k) => k.id === line.kit_id)
    if (!kit) continue
    const parts = line.slots.flatMap((sl) => {
      const slot = kit.slots.find((s) => s.id === sl.slot_id)
      const option = slot?.options.find((o) => o.product_id === sl.product_id)
      return slot && option
        ? [{ label: slot.label, name: option.name, size: sl.is_tailor ? 'May đo' : sl.size_label, colour: colourOf(option.colours, sl.colour), tailor: sl }]
        : []
    })
    rows.push({
      key: `kit:${kit.id}`,
      name: kit.name,
      image: kit.image,
      qty: line.qty,
      size: line.size_label,
      colour: null,
      unitPrice: kit.price,
      amount: kit.price == null ? null : kit.price * line.qty,
      parts,
    })
  }
  for (const line of lines.item_lines) {
    const item = ordering.items.find((i) => i.product_id === line.product_id)
    if (!item) continue
    rows.push({
      key: `item:${item.product_id}`,
      name: item.name,
      image: item.image,
      qty: line.qty,
      size: line.is_tailor ? 'May đo' : line.size_label,
      colour: colourOf(item.colours, line.colour),
      tailor: line,
      unitPrice: item.price,
      amount: item.price == null ? null : item.price * line.qty,
      parts: [],
    })
  }
  return rows
}

export type OrderingMode = 'none' | 'open' | 'locked'

export function orderingMode(ordering: Pick<Ordering, 'campaign'>): OrderingMode {
  if (!ordering.campaign) return 'none'
  return ordering.campaign.status === 'OPEN' ? 'open' : 'locked'
}
