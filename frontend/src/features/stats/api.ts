import { http } from '@/lib/http'

export interface ProductTrialStats {
  product_code: string
  product_name: string
  students_tried: number
  trials: number
}

export interface SizeGuideAccuracy {
  product_code: string
  product_name: string
  evaluated: number
  exact: number
  off_by_one: number
  off_by_two_plus: number
  exact_rate: number | null
}

export interface Overview {
  total_students: number
  students_with_trials: number
  total_trials: number
  students_with_notes: number
  by_product: ProductTrialStats[]
  size_guide_accuracy: SizeGuideAccuracy[]
}

export interface SizeBucket {
  size_label: string | null
  count: number
  percent: number
}

export interface SizeDistribution {
  product_code: string
  total: number
  sizes: SizeBucket[]
}

export interface ClassMatrixRow {
  class_id: string
  class_name: string
  grade: number
  counts: Record<string, number>
  unknown: number
  total: number
}

export interface ClassMatrix {
  product_code: string
  sizes: string[]
  rows: ClassMatrixRow[]
  totals: { counts: Record<string, number>; unknown: number; total: number }
}

export interface OrderProduct {
  product_code: string
  product_name: string
  sizes: { size_label: string; count: number }[]
  total: number
}

export interface Orders {
  products: OrderProduct[]
}

export const statsApi = {
  overview: (schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<Overview>('/stats/overview', { school_id: schoolId }, signal),
  sizeDistribution: (product: string, schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<SizeDistribution>('/stats/size-distribution', { product, school_id: schoolId }, signal),
  classMatrix: (product: string, schoolId: string, signal?: AbortSignal) =>
    http.get<ClassMatrix>('/stats/class-matrix', { product, school_id: schoolId }, signal),
  orders: (schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<Orders>('/stats/orders', { school_id: schoolId }, signal),
}
