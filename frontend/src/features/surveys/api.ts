import type { Gender } from '@/features/parent_accounts/api'
import { http } from '@/lib/http'

export type MeasureMethod = 'TAPE_TODAY' | 'RECENT_RECORD' | 'ESTIMATE'
export type BodyTrait = 'NORMAL' | 'ROUND_BELLY' | 'TALL_SLIM' | 'BROAD_SHOULDERS'
export type FitPreference = 'SLIM' | 'REGULAR' | 'LOOSE'
export type PastIssue = 'ITCHY_FABRIC' | 'HOT_WRINKLE_PILLING' | 'CROTCH_FIT' | 'NO_FITTING_SIZE'
export type SupplyOption = 'STANDARD' | 'TAILOR'

export interface SurveyBody {
  school_name: string
  province: string
  ward: string
  class_name: string
  child_full_name: string
  dob: string
  gender: Gender
  parent_phone: string
  measured_on: string
  measure_method: MeasureMethod
  height_cm: number
  weight_kg: number
  chest_cm: number | null
  waist_cm: number | null
  hip_cm: number | null
  body_traits: BodyTrait[]
  fit_preference: FitPreference | null
  past_issues: PastIssue[]
  supply_option: SupplyOption
}

export const surveyApi = {
  submit: (body: SurveyBody) => http.post<{ id: string }>('/public/surveys', body),
}
