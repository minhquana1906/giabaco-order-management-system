import { http } from '@/lib/http'

export type CampaignStatus = 'DRAFT' | 'OPEN' | 'LOCKED'
export type CampaignAction = 'open' | 'lock' | 'reopen'

export interface CampaignSummary {
  id: string
  school_id: string
  name: string
  school_year: string
  opens_at: string
  closes_at: string | null
  status: CampaignStatus
  updated_at: string
  item_count: number
  kit_count: number
}

export interface CampaignItem {
  product_id: string
  unit_price: number | null
  colour: string
  sort: number
}

export interface KitSlot {
  label: string
  qty: number
  product_ids: string[]
}

export interface Kit {
  code: string
  name: string
  slots: KitSlot[]
}

export interface Campaign extends Omit<CampaignSummary, 'item_count' | 'kit_count'> {
  items: CampaignItem[]
  kits: (Kit & { id: string })[]
}

export interface CampaignInfo {
  name: string
  school_year: string
  opens_at: string | null
  closes_at: string | null
}

export const campaignsApi = {
  list: (schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<CampaignSummary[]>('/campaigns', { school_id: schoolId }, signal),
  get: (id: string, signal?: AbortSignal) => http.get<Campaign>(`/campaigns/${id}`, undefined, signal),
  create: (body: CampaignInfo & { school_id: string }) => http.post<Campaign>('/campaigns', body),
  update: (id: string, body: CampaignInfo) => http.patch<Campaign>(`/campaigns/${id}`, body),
  replaceItems: (id: string, items: CampaignItem[]) =>
    http.put<Campaign>(`/campaigns/${id}/items`, { items }),
  replaceKits: (id: string, kits: Kit[]) => http.put<Campaign>(`/campaigns/${id}/kits`, { kits }),
  transition: (id: string, action: CampaignAction) => http.post<Campaign>(`/campaigns/${id}/${action}`),
}
