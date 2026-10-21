import type { CampaignStatus, Kit } from './api'

export const PRICE_PENDING = 'Giá đang cập nhật'

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Nháp',
  OPEN: 'Đang mở',
  LOCKED: 'Đã khóa',
}

export function defaultCampaignId(
  campaigns: { id: string; status: string; opens_at: string }[],
): string | undefined {
  const open = campaigns.find((c) => c.status === 'OPEN')
  if (open) return open.id
  const newest = [...campaigns].sort((a, b) => b.opens_at.localeCompare(a.opens_at))
  return (newest.find((c) => c.status !== 'DRAFT') ?? newest[0])?.id
}

export function kitPrice(
  selection: { qty: number; productId: string }[],
  prices: Record<string, number | null | undefined>,
): number | null {
  let total = 0
  for (const { qty, productId } of selection) {
    const price = prices[productId]
    if (price == null) return null
    total += price * qty
  }
  return total
}

export function suggestOption(
  productIds: string[],
  genderOf: Record<string, string>,
  gender: 'MALE' | 'FEMALE' | null,
): string {
  const match = gender ? productIds.find((id) => genderOf[id] === gender) : undefined
  return match ?? productIds[0] ?? ''
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export function uniqueKitCode(name: string, taken: string[]): string {
  const base = slugify(name).padEnd(2, '_') || 'bo'
  let code = base
  for (let n = 2; taken.includes(code); n++) code = `${base.slice(0, 36)}_${n}`
  return code
}

export function defaultSchoolYear(now = new Date()): string {
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${start + 1}`
}

export function toInputDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromInputDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function parsePrice(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

export function emptyKit(taken: string[]): Kit {
  return { code: uniqueKitCode('new', taken), name: '', slots: [{ label: '', qty: 1, product_ids: [] }] }
}
