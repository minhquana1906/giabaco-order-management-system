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
  data_source: DataSource
  height_cm: number | null
  weight_kg: number | null
  measured_at: string | null
  trials: PublicTrial[]
  products: PublicProduct[]
  choices: Record<string, string>
  suggested_sizes: Record<string, string | null>
}

export interface PortalSource {
  key: readonly unknown[]
  invalidate: readonly unknown[]
  get: (signal?: AbortSignal) => Promise<PublicStudent>
  choose: (productCode: string, sizeLabel: string) => Promise<{ chosen_at: string }>
  remove: (productCode: string) => Promise<void>
}

export function pathSource(
  base: string,
  key: readonly unknown[],
  invalidate: readonly unknown[] = key,
): PortalSource {
  const choice = (productCode: string) => `${base}/size-choices/${encodeURIComponent(productCode)}`
  return {
    key,
    invalidate,
    get: (signal) => http.get<PublicStudent>(base, undefined, signal),
    choose: (productCode, sizeLabel) =>
      http.put<{ chosen_at: string }>(choice(productCode), { size_label: sizeLabel }),
    remove: (productCode) => http.delete(choice(productCode)),
  }
}

export const tokenSource = (token: string) =>
  pathSource(`/public/students/${encodeURIComponent(token)}`, ['public-student', token])
