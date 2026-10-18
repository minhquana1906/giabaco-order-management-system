import type { Fit } from '@/lib/fit'
import { http } from '@/lib/http'

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
  height_cm: number | null
  weight_kg: number | null
  measured_at: string | null
  trials: PublicTrial[]
  products: PublicProduct[]
  choices: Record<string, string>
}

const base = (token: string) => `/public/students/${encodeURIComponent(token)}`

export const portalApi = {
  get: (token: string, signal?: AbortSignal) => http.get<PublicStudent>(base(token), undefined, signal),
  choose: (token: string, productCode: string, sizeLabel: string) =>
    http.put<{ chosen_at: string }>(`${base(token)}/size-choices/${encodeURIComponent(productCode)}`, {
      size_label: sizeLabel,
    }),
  remove: (token: string, productCode: string) =>
    http.delete(`${base(token)}/size-choices/${encodeURIComponent(productCode)}`),
}
