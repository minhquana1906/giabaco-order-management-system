import { downloadFile, http } from '@/lib/http'

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

export type PivotMeasure = 'qty' | 'orders' | 'amount'
export type PivotGroup = 'product' | 'kit' | 'class'

export interface PivotCounts {
  male: number
  female: number
  unknown: number
  total: number
}

export interface PivotQty extends PivotCounts {
  qty: PivotCounts
  unpriced_qty: PivotCounts
}

export interface PivotRow extends PivotQty {
  size_label: string
}

export interface PivotBlock {
  id: string
  name: string
  orders: number
  rows: PivotRow[]
  totals: PivotQty
}

export interface CampaignPivot {
  sizes: string[]
  blocks: PivotBlock[]
  grand_total: number
}

export interface CampaignOverview {
  orders: number
  items: number
  amount: number
  unpriced_items: number
  priced_items: number
  students_total: number
  students_with_order: number
  by_source: Record<string, number>
}

export interface PivotParams {
  campaignId: string
  measure: PivotMeasure
  group: PivotGroup
  productId?: string
  submittedUntil?: string
}

export const statsApi = {
  campaignPivot: ({ campaignId, measure, group, productId, submittedUntil }: PivotParams, signal?: AbortSignal) =>
    http.get<CampaignPivot>(
      '/stats/campaign-pivot',
      { campaign_id: campaignId, measure, group, product_id: productId, submitted_until: submittedUntil },
      signal,
    ),
  campaignOverview: (campaignId: string, submittedUntil: string | undefined, signal?: AbortSignal) =>
    http.get<CampaignOverview>(
      '/stats/campaign-overview',
      { campaign_id: campaignId, submitted_until: submittedUntil },
      signal,
    ),
  exportCampaignOrders: ({ campaignId, submittedUntil }: { campaignId: string; submittedUntil?: string }) =>
    downloadFile(
      '/export/campaign-orders.xlsx',
      { campaign_id: campaignId, submitted_until: submittedUntil },
      'campaign-orders.xlsx',
    ),
  overview: (schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<Overview>('/stats/overview', { school_id: schoolId }, signal),
  sizeDistribution: (product: string, schoolId: string | undefined, signal?: AbortSignal) =>
    http.get<SizeDistribution>('/stats/size-distribution', { product, school_id: schoolId }, signal),
  surveyOverview: (signal?: AbortSignal) => http.get<SurveyOverview>('/stats/surveys', undefined, signal),
  classMatrix: (product: string, schoolId: string, signal?: AbortSignal) =>
    http.get<ClassMatrix>('/stats/class-matrix', { product, school_id: schoolId }, signal),
}

export interface SurveyOverview {
  total_responses: number
  unique_children: number
  with_all_girths: number
  by_area: Record<string, number>
  by_gender: Record<string, number>
  by_measure_method: Record<string, number>
  by_supply_option: Record<string, number>
  schools: { school_name: string; province: string; school_area: string; responses: number }[]
}
