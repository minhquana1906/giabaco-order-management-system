import { dobToIso } from '@/lib/dob'
import type { Fit } from '@/lib/fit'
import type { Product } from '@/features/catalog/api'
import type { Gender, StudentDetail, StudentIn } from '../api'

export const HEIGHT_RANGE = { min: 90, max: 190 }
export const WEIGHT_RANGE = { min: 10, max: 90 }
export const NOTE_MAX = 500

export interface TrialRow {
  key: string
  id: string | null
  size: string
  fit: Fit | null
  note: string
  manual: boolean
}

export type TrialsState = Record<string, TrialRow[]>
export type Suggestions = Record<string, string | null>

export interface FormValues {
  fullName: string
  day: string
  month: string
  year: string
  gender: Gender | ''
  height: string
  weight: string
  parentName: string
  parentPhone: string
  parentEmail: string
  trials: TrialsState
}

let seq = 0
export const newRow = (init: Partial<TrialRow> = {}): TrialRow => ({
  key: `row-${++seq}`,
  id: null,
  size: '',
  fit: null,
  note: '',
  manual: true,
  ...init,
})

export const emptyValues = (): FormValues => ({
  fullName: '',
  day: '',
  month: '',
  year: '',
  gender: '',
  height: '',
  weight: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  trials: {},
})

export function valuesFromStudent(s: StudentDetail): FormValues {
  const [year = '', month = '', day = ''] = s.dob.split('-')
  const trials: TrialsState = {}
  for (const t of s.trials) {
    ;(trials[t.product_code] ??= []).push(
      newRow({ id: t.id, size: t.size_label, fit: t.fit, note: t.note ?? '' }),
    )
  }
  return {
    fullName: s.full_name,
    day: String(Number(day)),
    month: String(Number(month)),
    year,
    gender: s.gender,
    height: String(s.height_cm),
    weight: String(s.weight_kg),
    parentName: s.parent_name ?? '',
    parentPhone: s.parent_phone ?? '',
    parentEmail: s.parent_email ?? '',
    trials,
  }
}

export function parseMeasure(text: string, range: { min: number; max: number }): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n >= range.min && n <= range.max ? n : null
}

const dobIso = (v: FormValues) => dobToIso(v)

export const trialErrorKey = (rowKey: string) => `trial:${rowKey}`

export function validate(v: FormValues, ctx: { schoolId: string; classId: string }): Record<string, string> {
  const e: Record<string, string> = {}
  if (!ctx.schoolId) e.school_id = 'Chọn trường'
  if (!ctx.classId) e.class_id = 'Chọn lớp'
  if (!v.fullName.trim()) e.full_name = 'Nhập họ tên học sinh'
  if (!dobIso(v)) e.dob = 'Chọn ngày, tháng, năm sinh hợp lệ'
  if (!v.gender) e.gender = 'Chọn giới tính'
  if (parseMeasure(v.height, HEIGHT_RANGE) === null)
    e.height_cm = `Chiều cao từ ${HEIGHT_RANGE.min} đến ${HEIGHT_RANGE.max} cm`
  if (parseMeasure(v.weight, WEIGHT_RANGE) === null)
    e.weight_kg = `Cân nặng từ ${WEIGHT_RANGE.min} đến ${WEIGHT_RANGE.max} kg`
  for (const rows of Object.values(v.trials)) {
    for (const r of rows) {
      if (!r.size && !r.fit) continue
      if (!r.manual && !r.fit && !r.note.trim()) continue
      if (!r.size) e[trialErrorKey(r.key)] = 'Chọn cỡ đã thử'
      else if (!r.fit) e[trialErrorKey(r.key)] = `Chọn Chật / Vừa / Rộng cho cỡ ${r.size}`
      else if (r.note.length > NOTE_MAX) e[trialErrorKey(r.key)] = `Ghi chú tối đa ${NOTE_MAX} ký tự`
    }
  }
  return e
}

const orNull = (s: string) => s.trim() || null

export function toPayload(
  v: FormValues,
  ctx: { schoolId: string; classId: string },
  productCodes: string[],
  force: boolean,
): { payload: StudentIn; rowKeys: string[] } {
  const rowKeys: string[] = []
  const trials: StudentIn['trials'] = []
  for (const code of productCodes) {
    for (const r of v.trials[code] ?? []) {
      if (!r.size || !r.fit) continue
      rowKeys.push(r.key)
      trials.push({ id: r.id, product_code: code, size_label: r.size, fit: r.fit, note: orNull(r.note) })
    }
  }
  const round1 = (n: number) => Math.round(n * 10) / 10
  return {
    rowKeys,
    payload: {
      school_id: ctx.schoolId,
      class_id: ctx.classId,
      full_name: v.fullName.trim(),
      dob: dobIso(v)!,
      gender: v.gender as Gender,
      height_cm: round1(parseMeasure(v.height, HEIGHT_RANGE)!),
      weight_kg: round1(parseMeasure(v.weight, WEIGHT_RANGE)!),
      parent_name: orNull(v.parentName),
      parent_phone: orNull(v.parentPhone),
      parent_email: orNull(v.parentEmail),
      trials,
      force,
    },
  }
}

export function mapServerFields(fields: Record<string, string>, rowKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, message] of Object.entries(fields)) {
    const m = /^trials\.(\d+)\./.exec(path)
    const rowKey = m ? rowKeys[Number(m[1])] : undefined
    out[m && rowKey ? trialErrorKey(rowKey) : path] = message
  }
  return out
}

export function applySuggestions(trials: TrialsState, suggestions: Suggestions | null): TrialsState {
  if (!suggestions) return trials
  const next = { ...trials }
  for (const [code, size] of Object.entries(suggestions)) {
    const rows = trials[code] ?? []
    if (rows.length === 0) {
      if (size) next[code] = [newRow({ size, manual: false })]
      continue
    }
    next[code] = rows.flatMap((r) => {
      if (r.manual || r.fit || r.note.trim()) return [r]
      if (!size) return []
      if (rows.some((o) => o !== r && o.size === size)) return [r]
      return [{ ...r, size }]
    })
  }
  return next
}

export function derivedSize(rows: TrialRow[], product: Product): string | null {
  let best = -1
  for (const r of rows) {
    if (r.fit === 'FITS') best = Math.max(best, product.sizes.indexOf(r.size))
  }
  return best < 0 ? null : (product.sizes[best] ?? null)
}
