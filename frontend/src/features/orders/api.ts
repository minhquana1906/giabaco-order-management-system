import { http } from '@/lib/http'

export type OrderStatus = 'DRAFT' | 'SUBMITTED'
export type OrderGender = 'MALE' | 'FEMALE'
export type OrderGenderFilter = OrderGender | 'UNKNOWN'
export type OrderSource = 'PARENT' | 'STAFF' | 'LEGACY_IMPORT'

export interface OrderListParams {
  q?: string
  gender?: OrderGenderFilter
  status?: OrderStatus
  page?: number
}

export interface OrderSummary {
  id: string
  code: string
  recipient_name: string
  class_label: string | null
  gender: OrderGender | null
  status: OrderStatus
  source: OrderSource
  item_count: number
  total: number
  has_unpriced: boolean
  submitted_at: string | null
  updated_at: string
}

export interface OrderPage {
  items: OrderSummary[]
  total: number
  page: number
  page_size: number
}

export interface OrderLine {
  id: string
  kit_line_id: string | null
  slot_id: string | null
  slot_label: string | null
  product_id: string
  product_name: string
  sizes: string[]
  colours: string[]
  size_label: string
  colour: string
  qty: number
  unit_price: number | null
}

export interface OrderKitLine {
  id: string
  kit_id: string
  kit_name: string
  qty: number
}

export interface OrderHistory {
  at: string
  actor: string
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface OrderDetail extends OrderSummary {
  campaign_id: string
  campaign_status: 'DRAFT' | 'OPEN' | 'LOCKED'
  student_id: string | null
  parent_name: string | null
  parent_phone: string | null
  default_size: string | null
  note: string | null
  kit_lines: OrderKitLine[]
  lines: OrderLine[]
  history: OrderHistory[]
}

export interface LinesPayload {
  kit_lines: {
    kit_id: string
    qty: number
    slots: { slot_id: string; product_id: string; size_label: string }[]
  }[]
  item_lines: { product_id: string; size_label: string; qty: number; colour: string }[]
  submit: boolean
}

export interface OrderPatch {
  note?: string | null
  class_label?: string | null
  gender?: OrderGender | null
}

export const ORDERS_PAGE_SIZE = 50

export const ordersApi = {
  list: (campaignId: string, params: OrderListParams, signal?: AbortSignal) =>
    http.get<OrderPage>(`/campaigns/${campaignId}/orders`, { ...params }, signal),
  get: (id: string, signal?: AbortSignal) => http.get<OrderDetail>(`/orders/${id}`, undefined, signal),
  replaceLines: (id: string, body: LinesPayload) => http.put<OrderDetail>(`/orders/${id}/lines`, body),
  patch: (id: string, body: OrderPatch) => http.patch<OrderDetail>(`/orders/${id}`, body),
}
