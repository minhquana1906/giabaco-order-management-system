import type { Fit } from '@/lib/fit'
import { http } from '@/lib/http'

export type DataSource = 'ADMIN_MEASURED' | 'PARENT_DECLARED'

export interface PublicTrial {
  product_code: string
  product_name: string
  size_label: string
  fit: Fit
}

export interface PublicProduct {
  code: string
  name: string
  sizes: string[]
}

export interface PublicStudent {
  full_name: string
  school_name: string
  class_name: string
  gender: 'MALE' | 'FEMALE'
  data_source: DataSource
  height_cm: number | null
  weight_kg: number | null
  measured_at: string | null
  trials: PublicTrial[]
  products: PublicProduct[]
  suggested_sizes: Record<string, string | null>
}

export interface Img {
  url: string
  width: number
  height: number
}

export interface Colour {
  code: string
  label: string
  hex: string
}

export interface KitOption {
  product_id: string
  code: string
  name: string
  sizes: string[]
  colours: Colour[]
  image: Img | null
  suggested: boolean
}

export interface KitSlot {
  id: string
  label: string
  qty: number
  options: KitOption[]
}

export interface Kit {
  id: string
  name: string
  price: number | null
  image: Img | null
  slots: KitSlot[]
}

export interface LooseItem {
  product_id: string
  code: string
  name: string
  price: number | null
  sizes: string[]
  colours: Colour[]
  image: Img | null
}

export interface SlotLine {
  slot_id: string
  product_id: string
  size_label: string
  colour: string | null
}

export interface KitLine {
  kit_id: string
  qty: number
  size_label: string
  slots: SlotLine[]
}

export interface ItemLine {
  product_id: string
  size_label: string
  colour: string | null
  qty: number
}

export interface OrderLines {
  kit_lines: KitLine[]
  item_lines: ItemLine[]
}

export interface OrderView extends OrderLines {
  id: string
  code: string
  status: string
  total: number
  has_unpriced: boolean
  submitted_at: string | null
}

export interface Campaign {
  id: string
  name: string
  status: 'OPEN' | 'LOCKED'
  closes_at: string | null
}

export interface Ordering {
  campaign: Campaign | null
  kits: Kit[]
  items: LooseItem[]
  suggested_sizes: Record<string, string | null>
  order: OrderView | null
}

export interface PortalSource {
  key: readonly unknown[]
  orderingKey: readonly unknown[]
  invalidate: readonly unknown[]
  get: (signal?: AbortSignal) => Promise<PublicStudent>
  getOrdering: (signal?: AbortSignal) => Promise<Ordering>
  saveOrder: (lines: OrderLines) => Promise<Ordering>
}

export function pathSource(
  base: string,
  key: readonly unknown[],
  invalidate: readonly unknown[] = key,
): PortalSource {
  return {
    key,
    orderingKey: [...key, 'ordering'],
    invalidate,
    get: (signal) => http.get<PublicStudent>(base, undefined, signal),
    getOrdering: (signal) => http.get<Ordering>(`${base}/ordering`, undefined, signal),
    saveOrder: (lines) => http.put<Ordering>(`${base}/order`, lines),
  }
}

export const tokenSource = (token: string) =>
  pathSource(`/public/students/${encodeURIComponent(token)}`, ['public-student', token])
