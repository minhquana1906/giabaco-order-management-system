import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { EMAIL_PATTERN, isValidPhone } from './authLogic'
import type { ChildKey, CreateChildBody, DeclaredBody, Gender, LookupResponse } from './api'

export type AddChildStep = 'search' | 'confirm' | 'declare' | 'contact'

export interface StepOutcome {
  step: AddChildStep
  notice: string | null
}

export const HEIGHT_RANGE = { min: 90, max: 190 }
export const WEIGHT_RANGE = { min: 10, max: 90 }

export function stepAfterLookup(result: LookupResponse): AddChildStep {
  if (!result.found) return 'declare'
  return result.ambiguous ? 'contact' : 'confirm'
}

export function outcomeAfterClaimError(error: unknown): StepOutcome | null {
  if (!(error instanceof ApiError)) return null
  if (error.code === 'ambiguous_match') return { step: 'contact', notice: null }
  if (error.code === 'no_match') {
    return { step: 'search', notice: 'Hồ sơ này không còn khớp. Vui lòng kiểm tra thông tin rồi tìm lại.' }
  }
  return null
}

export function outcomeAfterCreateError(error: unknown): StepOutcome | null {
  if (error instanceof ApiError && error.code === 'child_exists') {
    return { step: 'search', notice: 'Hồ sơ này đã có trong hệ thống. Hãy tìm lại để nhận hồ sơ đó.' }
  }
  return null
}

export type ChildKeyErrors = Partial<Record<keyof ChildKey, string>>

export function validateChildKey(values: ChildKey, today: string): ChildKeyErrors {
  const errors: ChildKeyErrors = {}
  if (!values.school_id) errors.school_id = 'Vui lòng chọn trường.'
  if (!values.full_name.trim()) errors.full_name = 'Vui lòng nhập họ và tên học sinh.'
  if (!values.dob || values.dob > today) errors.dob = 'Chọn ngày, tháng, năm sinh hợp lệ'
  return errors
}

export function normalizeChildKey(values: ChildKey): ChildKey {
  return { ...values, full_name: values.full_name.trim().replace(/\s+/g, ' ') }
}

export interface DeclaredValues {
  class_id: string
  gender: Gender | ''
  height: string
  weight: string
  parent_phone: string
  parent_name: string
  parent_email: string
}

export type DeclaredErrors = Partial<Record<keyof DeclaredValues, string>>

export function parseMeasure(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

function measureError(text: string, label: string, unit: string, range: { min: number; max: number }) {
  const value = parseMeasure(text)
  if (value === null) return `Vui lòng nhập ${label}.`
  if (value < range.min || value > range.max) return `${label[0]!.toUpperCase()}${label.slice(1)} cần từ ${range.min} đến ${range.max} ${unit}.`
  return undefined
}

export function validateDeclared(values: DeclaredValues): DeclaredErrors {
  const errors: DeclaredErrors = {}
  if (!values.class_id) errors.class_id = 'Vui lòng chọn lớp.'
  if (!values.gender) errors.gender = 'Vui lòng chọn giới tính.'
  const height = measureError(values.height, 'chiều cao', 'cm', HEIGHT_RANGE)
  if (height) errors.height = height
  const weight = measureError(values.weight, 'cân nặng', 'kg', WEIGHT_RANGE)
  if (weight) errors.weight = weight
  const phone = values.parent_phone.trim()
  if (!phone) errors.parent_phone = 'Vui lòng nhập số điện thoại.'
  else if (!isValidPhone(phone)) errors.parent_phone = 'Số điện thoại chưa đúng định dạng.'
  const email = values.parent_email.trim()
  if (email && !EMAIL_PATTERN.test(email)) errors.parent_email = 'Email chưa đúng định dạng.'
  return errors
}

export function toDeclaredBody(values: DeclaredValues): DeclaredBody {
  return {
    class_id: values.class_id,
    gender: values.gender as Gender,
    height_cm: parseMeasure(values.height)!,
    weight_kg: parseMeasure(values.weight)!,
    parent_phone: values.parent_phone.trim(),
    parent_name: values.parent_name.trim() || null,
    parent_email: values.parent_email.trim() || null,
  }
}

export function toCreateBody(key: ChildKey, declared: DeclaredBody): CreateChildBody {
  return { ...normalizeChildKey(key), ...declared }
}

export function fieldErrorsFromApi(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.status === 422 && error.fields ? error.fields : {}
}

const DECLARED_API_FIELDS = ['class_id', 'gender', 'height_cm', 'weight_kg', 'parent_phone', 'parent_name', 'parent_email']

export function childErrorMessage(error: unknown, fallback: string): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.code === 'measured_locked' || error.code === 'child_limit') return error.message
    if (error.status === 422 && DECLARED_API_FIELDS.some((key) => error.fields?.[key])) return null
  }
  return requestErrorMessage(error, fallback)
}
