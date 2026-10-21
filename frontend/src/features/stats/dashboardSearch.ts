import type { PivotGroup, PivotMeasure } from './api'

export type DashboardView = 'measure' | 'orders'
export type GenderFilter = 'all' | 'male' | 'female'

export interface DashboardSearch {
  school_id?: string
  view?: 'orders'
  product?: string
  campaign_id?: string
  group?: Exclude<PivotGroup, 'product'>
  gender?: Exclude<GenderFilter, 'all'>
  measure?: Exclude<PivotMeasure, 'qty'>
  until?: string
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]) => allowed.find((a) => a === value)

export function parseDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  return {
    school_id: text(search.school_id),
    view: oneOf(search.view, ['orders']),
    product: text(search.product),
    campaign_id: text(search.campaign_id),
    group: oneOf(search.group, ['kit', 'class']),
    gender: oneOf(search.gender, ['male', 'female']),
    measure: oneOf(search.measure, ['orders', 'amount']),
    until: typeof search.until === 'string' && DATE_ONLY.test(search.until) ? search.until : undefined,
  }
}

export interface DashboardParams {
  view: DashboardView
  schoolId?: string
  product?: string
  campaignId?: string
  group: PivotGroup
  gender: GenderFilter
  measure: PivotMeasure
  until?: string
}

export const dashboardParams = (search: DashboardSearch): DashboardParams => ({
  view: search.view ?? 'measure',
  schoolId: search.school_id,
  product: search.product,
  campaignId: search.campaign_id,
  group: search.group ?? 'product',
  gender: search.gender ?? 'all',
  measure: search.measure ?? 'qty',
  until: search.until,
})

export function patchSearch(prev: DashboardSearch, patch: Partial<Record<keyof DashboardSearch, string | undefined>>) {
  return parseDashboardSearch({ ...prev, ...patch })
}

export const withSchool = (prev: DashboardSearch, schoolId: string) =>
  patchSearch(prev, { school_id: schoolId, product: undefined, campaign_id: undefined })
