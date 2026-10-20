import type { Fit } from '@/lib/fit'
import { http } from '@/lib/http'
import type { ProductColour } from '@/lib/productColour'

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

export interface PublicChoice {
  size_label: string
  colour: ProductColour | null
}

export interface ChoiceInput {
  size_label: string
  colour: ProductColour
}

export type ChoiceChanges = Record<string, ChoiceInput | undefined>

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
  choices: Record<string, PublicChoice>
  suggested_sizes: Record<string, string | null>
}

export interface PortalSource {
  key: readonly unknown[]
  invalidate: readonly unknown[]
  get: (signal?: AbortSignal) => Promise<PublicStudent>
  choose: (productCode: string, choice: ChoiceInput) => Promise<{ chosen_at: string }>
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
    choose: (productCode, input) => http.put<{ chosen_at: string }>(choice(productCode), input),
    remove: (productCode) => http.delete(choice(productCode)),
  }
}

export const tokenSource = (token: string) =>
  pathSource(`/public/students/${encodeURIComponent(token)}`, ['public-student', token])
