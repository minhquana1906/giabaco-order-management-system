import type { Gender } from '@/features/parent_accounts/api'
import { HEIGHT_RANGE, parseMeasure, WEIGHT_RANGE } from '@/features/parent_accounts/addChildLogic'
import { dobToIso, EMPTY_DOB, type DobParts } from '@/lib/dob'
import type { BodyTrait, FitPreference, MeasureMethod, PastIssue, SupplyOption, SurveyBody } from './api'

export const CHEST_RANGE = { min: 40, max: 140 }
export const WAIST_RANGE = { min: 35, max: 140 }
export const HIP_RANGE = { min: 40, max: 150 }
export const MAX_MEASUREMENT_AGE_DAYS = 180

export const MEASURE_METHODS: { value: MeasureMethod; label: string }[] = [
  { value: 'TAPE_TODAY', label: 'Vừa đo cho con theo hướng dẫn' },
  { value: 'RECENT_RECORD', label: 'Lấy số đo gần đây (sổ sức khỏe, trường đo)' },
  { value: 'ESTIMATE', label: 'Ước lượng, chưa đo' },
]

export const BODY_TRAITS: { value: BodyTrait; label: string }[] = [
  { value: 'NORMAL', label: 'Thể trạng bình thường, dễ mặc đồ may sẵn' },
  { value: 'ROUND_BELLY', label: 'Bụng tròn, dày mình (hay chật cạp quần)' },
  { value: 'TALL_SLIM', label: 'Cao gầy, tay chân dài (vừa dài thì thân bị rộng)' },
  { value: 'BROAD_SHOULDERS', label: 'Vai to, nở nang (hay chật vai, kích nách)' },
]

export const FIT_PREFERENCES: { value: FitPreference; label: string }[] = [
  { value: 'SLIM', label: 'Ôm vừa vặn' },
  { value: 'REGULAR', label: 'Vừa phải' },
  { value: 'LOOSE', label: 'Rộng rãi, dễ vận động' },
]

export const PAST_ISSUES: { value: PastIssue; label: string }[] = [
  { value: 'ITCHY_FABRIC', label: 'Vải cứng, cọ cổ/nách gây ngứa' },
  { value: 'HOT_WRINKLE_PILLING', label: 'Vải bí, dễ nhăn, nhanh xù lông' },
  { value: 'CROTCH_FIT', label: 'Đũng quần quá dài hoặc quá ngắn' },
  { value: 'NO_FITTING_SIZE', label: 'Bảng cỡ may sẵn không có cỡ vừa cho con' },
]

export const SUPPLY_OPTIONS: { value: SupplyOption; label: string; hint: string }[] = [
  {
    value: 'STANDARD',
    label: 'Nhận đồ theo bảng cỡ chuẩn hóa của Giabaco',
    hint: 'Kèm bảo hành đổi trả miễn phí tận tay.',
  },
  {
    value: 'TAILOR',
    label: 'Đăng ký thợ may đo riêng miễn phí tại trường',
    hint: 'Dành cho con thuộc nhóm ngoại cỡ đặc biệt.',
  },
]

export interface SurveyValues {
  school_name: string
  province: string
  ward: string
  class_name: string
  child_full_name: string
  dob: DobParts
  gender: Gender | ''
  parent_phone: string
  measured_on: string
  measure_method: MeasureMethod | ''
  height: string
  weight: string
  chest: string
  waist: string
  hip: string
  body_traits: BodyTrait[]
  fit_preference: FitPreference | ''
  past_issues: PastIssue[]
  supply_option: SupplyOption | ''
}

export type SurveyErrors = Partial<Record<keyof SurveyValues, string>>

export function emptySurvey(today: string): SurveyValues {
  return {
    school_name: '',
    province: '',
    ward: '',
    class_name: '',
    child_full_name: '',
    dob: EMPTY_DOB,
    gender: '',
    parent_phone: '',
    measured_on: today,
    measure_method: '',
    height: '',
    weight: '',
    chest: '',
    waist: '',
    hip: '',
    body_traits: [],
    fit_preference: '',
    past_issues: [],
    supply_option: '',
  }
}

const DRAFT_KEY = 'guniform-survey-draft'

/** Unsent answers survive a reload, e.g. Zalo's in-app browser killed while the parent measures. */
export function loadDraft(today: string): SurveyValues {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (saved && typeof saved === 'object') return { ...emptySurvey(today), ...saved }
  } catch {
    // Storage blocked (private mode) or a corrupt draft: start empty.
  }
  return emptySurvey(today)
}

export function saveDraft(values: SurveyValues | null): void {
  try {
    if (values) localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage full or blocked: the form still works, only without a draft.
  }
}

export function isoDaysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const PHONE_RE = /^(?:\+?84|0)\d{9}$/

function rangeError(
  text: string,
  label: string,
  range: { min: number; max: number },
  unit: string,
  required: boolean,
) {
  if (!text.trim()) return required ? `Vui lòng nhập ${label}.` : undefined
  const value = parseMeasure(text)
  if (value === null) return `${label[0]!.toUpperCase()}${label.slice(1)} chỉ gồm số, ví dụ ${range.min + 20}.`
  // Parents often type metres (1.35) instead of centimetres.
  if (value < 3 && range.min > 3) return `Nhập theo cm, ví dụ 1m35 thì nhập 135.`
  if (value < range.min || value > range.max) {
    return `${label[0]!.toUpperCase()}${label.slice(1)} phải từ ${range.min} đến ${range.max} ${unit}.`
  }
  return undefined
}

export function validateSurvey(values: SurveyValues, today: string): SurveyErrors {
  const errors: SurveyErrors = {}
  const set = (key: keyof SurveyValues, message: string | undefined) => {
    if (message) errors[key] = message
  }
  set('school_name', values.school_name.trim() ? undefined : 'Vui lòng nhập tên trường.')
  set('province', values.province ? undefined : 'Vui lòng chọn tỉnh/thành phố.')
  set('ward', values.ward ? undefined : 'Vui lòng chọn phường/xã.')
  set('class_name', values.class_name.trim() ? undefined : 'Vui lòng nhập lớp của học sinh.')
  set('child_full_name', values.child_full_name.trim() ? undefined : 'Vui lòng nhập họ và tên học sinh.')
  const dob = dobToIso(values.dob)
  set('dob', dob ? undefined : 'Vui lòng chọn ngày, tháng, năm sinh hợp lệ.')
  set('gender', values.gender ? undefined : 'Vui lòng chọn giới tính.')
  set(
    'parent_phone',
    PHONE_RE.test(values.parent_phone.replace(/[\s.\-()]/g, '')) ? undefined : 'Số điện thoại gồm 10 số, ví dụ 0912345678.',
  )
  if (!values.measured_on || values.measured_on > today) set('measured_on', 'Chọn ngày đo, không sau hôm nay.')
  else if (values.measured_on < isoDaysBefore(today, MAX_MEASUREMENT_AGE_DAYS)) {
    set('measured_on', 'Số đo đã cũ hơn 6 tháng, vui lòng đo lại cho học sinh.')
  } else if (dob && values.measured_on <= dob) set('measured_on', 'Ngày đo phải sau ngày sinh.')
  set('measure_method', values.measure_method ? undefined : 'Vui lòng cho biết cách lấy số đo.')
  set('height', rangeError(values.height, 'chiều cao', HEIGHT_RANGE, 'cm', true))
  set('weight', rangeError(values.weight, 'cân nặng', WEIGHT_RANGE, 'kg', true))
  set('chest', rangeError(values.chest, 'vòng ngực', CHEST_RANGE, 'cm', false))
  set('waist', rangeError(values.waist, 'vòng eo', WAIST_RANGE, 'cm', false))
  set('hip', rangeError(values.hip, 'vòng mông', HIP_RANGE, 'cm', false))
  set('supply_option', values.supply_option ? undefined : 'Vui lòng chọn hình thức nhận đồ.')
  return errors
}

/** Soft plausibility checks: shown to the parent, never block submission. */
export function measurementWarnings(values: SurveyValues): string[] {
  const height = parseMeasure(values.height)
  const weight = parseMeasure(values.weight)
  const chest = parseMeasure(values.chest)
  const waist = parseMeasure(values.waist)
  const hip = parseMeasure(values.hip)
  const warnings: string[] = []
  if (height && weight && height >= HEIGHT_RANGE.min) {
    const bmi = weight / (height / 100) ** 2
    if (bmi < 11 || bmi > 32) warnings.push('Chiều cao và cân nặng có vẻ chưa khớp nhau. Vui lòng kiểm tra lại.')
  }
  if (chest && waist && waist > chest + 15) warnings.push('Vòng eo lớn hơn vòng ngực khá nhiều. Vui lòng đo lại vòng eo.')
  if (waist && hip && hip < waist - 10) warnings.push('Vòng mông nhỏ hơn vòng eo khá nhiều. Vui lòng đo lại.')
  return warnings
}

const optional = (text: string) => (text.trim() ? parseMeasure(text) : null)

export function toSurveyBody(values: SurveyValues): SurveyBody {
  const text = (v: string) => v.trim().replace(/\s+/g, ' ')
  return {
    school_name: text(values.school_name),
    province: text(values.province),
    ward: values.ward,
    class_name: text(values.class_name),
    child_full_name: values.child_full_name.trim().replace(/\s+/g, ' '),
    dob: dobToIso(values.dob)!,
    gender: values.gender as Gender,
    parent_phone: values.parent_phone.trim(),
    measured_on: values.measured_on,
    measure_method: values.measure_method as MeasureMethod,
    height_cm: parseMeasure(values.height)!,
    weight_kg: parseMeasure(values.weight)!,
    chest_cm: optional(values.chest),
    waist_cm: optional(values.waist),
    hip_cm: optional(values.hip),
    body_traits: values.body_traits,
    fit_preference: values.fit_preference || null,
    past_issues: values.past_issues,
    supply_option: values.supply_option as SupplyOption,
  }
}

const API_FIELDS: Record<string, keyof SurveyValues> = {
  school_name: 'school_name',
  province: 'province',
  ward: 'ward',
  class_name: 'class_name',
  child_full_name: 'child_full_name',
  dob: 'dob',
  gender: 'gender',
  parent_phone: 'parent_phone',
  measured_on: 'measured_on',
  measure_method: 'measure_method',
  height_cm: 'height',
  weight_kg: 'weight',
  chest_cm: 'chest',
  waist_cm: 'waist',
  hip_cm: 'hip',
  body_traits: 'body_traits',
  fit_preference: 'fit_preference',
  past_issues: 'past_issues',
  supply_option: 'supply_option',
}

/** Server keys are pydantic paths: a bad list item arrives as `body_traits.0`. */
const fieldOf = (key: string): keyof SurveyValues | undefined => API_FIELDS[key.replace(/\.\d+$/, '')]

export function surveyErrorsFromApi(fields: Record<string, string> | undefined): SurveyErrors {
  const errors: SurveyErrors = {}
  for (const [key, message] of Object.entries(fields ?? {})) {
    const field = fieldOf(key)
    if (field) errors[field] = message
  }
  return errors
}

/** Server field names that no visible input shows, so their errors would otherwise go unseen. */
export function unmappedApiFields(fields: Record<string, string> | undefined): string[] {
  return Object.keys(fields ?? {}).filter((key) => !fieldOf(key))
}
