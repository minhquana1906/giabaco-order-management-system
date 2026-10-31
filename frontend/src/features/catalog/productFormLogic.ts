import type { GenderTarget, Product, ProductBody, SizeGuideRow, TailorMeasurement } from './api'

export interface SizeRowForm {
  label: string
  heightMin: string
  heightMax: string
  weightMin: string
  weightMax: string
}

export interface ProductForm {
  code: string
  name: string
  description: string
  genderTarget: GenderTarget
  masterProductId: string
  colours: string[]
  sizes: SizeRowForm[]
  tailorMeasurements: TailorMeasurement[]
}

export type ProductFormErrors = Record<string, string>

export const CODE_PATTERN = /^[a-z0-9_]{2,40}$/
const CODE_ERROR = 'Mã chỉ gồm chữ thường không dấu, số hoặc dấu gạch dưới, dài 2 đến 40 ký tự.'
export const MAX_GUIDE_VALUE = 300

export const emptySizeRow = (label = ''): SizeRowForm => ({
  label,
  heightMin: '',
  heightMax: '',
  weightMin: '',
  weightMax: '',
})

export const emptyForm = (): ProductForm => ({
  code: '',
  name: '',
  description: '',
  genderTarget: 'UNISEX',
  masterProductId: '',
  colours: [],
  sizes: ['1', '2', '3', '4', '5', '6', '7'].map(emptySizeRow),
  tailorMeasurements: [],
})

const text = (value: number | null) => (value === null ? '' : String(value))

export function formFromProduct(product: Product): ProductForm {
  const guide = new Map((product.size_guide ?? []).map((row) => [row.size_label, row]))
  return {
    code: product.code,
    name: product.name,
    description: product.description ?? '',
    genderTarget: product.gender_target,
    masterProductId: product.master_product_id ?? '',
    colours: product.colours,
    tailorMeasurements: product.tailor_measurements ?? [],
    sizes: product.sizes.map((label) => {
      const row = guide.get(label)
      return row
        ? {
            label,
            heightMin: text(row.height_min_cm),
            heightMax: text(row.height_max_cm),
            weightMin: text(row.weight_min_kg),
            weightMax: text(row.weight_max_kg),
          }
        : emptySizeRow(label)
    }),
  }
}

function parse(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : Number.NaN
}

const hasGuide = (row: SizeRowForm) =>
  [row.heightMin, row.heightMax, row.weightMin, row.weightMax].some((v) => v.trim() !== '')

function guideError(row: SizeRowForm): string | null {
  if (!hasGuide(row)) return null
  const hMin = parse(row.heightMin)
  const hMax = parse(row.heightMax)
  const wMin = parse(row.weightMin)
  const wMax = parse(row.weightMax)
  if (hMin === null || wMin === null) return 'Nhập chiều cao và cân nặng tối thiểu của cỡ này.'
  const values = [hMin, hMax, wMin, wMax]
  if (values.some((v) => v !== null && (Number.isNaN(v) || v < 0 || v > MAX_GUIDE_VALUE))) {
    return `Số đo phải là số từ 0 đến ${MAX_GUIDE_VALUE}.`
  }
  if (hMax !== null && hMax <= hMin) return 'Chiều cao tối đa phải lớn hơn tối thiểu'
  if (wMax !== null && wMax <= wMin) return 'Cân nặng tối đa phải lớn hơn tối thiểu'
  return null
}

export function validateForm(form: ProductForm, mode: 'create' | 'edit'): ProductFormErrors {
  const errors: ProductFormErrors = {}
  if (mode === 'create' && !CODE_PATTERN.test(form.code)) {
    errors.code = CODE_ERROR
  }
  if (form.name.trim() === '') errors.name = 'Nhập tên sản phẩm.'
  if (form.colours.length === 0) errors.colours = 'Chọn ít nhất một màu cho sản phẩm.'
  if (form.sizes.length === 0) errors.sizes = 'Thêm ít nhất một cỡ cho sản phẩm.'
  const labels = form.sizes.map((s) => s.label.trim())
  form.sizes.forEach((row, i) => {
    const label = labels[i] ?? ''
    if (label === '') errors[`size-${i}`] = 'Nhập tên cho cỡ này.'
    else if (labels.indexOf(label) !== i)
      errors[`size-${i}`] = 'Tên cỡ này đã dùng ở dòng khác. Đổi tên để tiếp tục.'
    else {
      const error = guideError(row)
      if (error) errors[`size-${i}`] = error
    }
  })
  const keys = form.tailorMeasurements.map((field) => field.key)
  form.tailorMeasurements.forEach((field, i) => {
    if (!field.key) errors[`measurement-${i}`] = 'Chọn loại số đo cho dòng này.'
    else if (keys.indexOf(field.key) !== i)
      errors[`measurement-${i}`] = 'Loại số đo này đã chọn ở dòng khác. Chọn loại khác để tiếp tục.'
    else if (!field.label.trim()) errors[`measurement-${i}`] = 'Nhập tên cho số đo này.'
  })
  return errors
}

export function toBody(form: ProductForm): ProductBody {
  const guide: SizeGuideRow[] = form.sizes.filter(hasGuide).map((row) => ({
    size_label: row.label.trim(),
    height_min_cm: parse(row.heightMin) ?? 0,
    height_max_cm: parse(row.heightMax),
    weight_min_kg: parse(row.weightMin) ?? 0,
    weight_max_kg: parse(row.weightMax),
  }))
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    sizes: form.sizes.map((s) => s.label.trim()),
    size_guide: guide.length > 0 ? guide : null,
    tailor_measurements: form.tailorMeasurements.map((field) => ({ ...field, label: field.label.trim(), instruction: field.instruction.trim() })),
    colours: form.colours,
    gender_target: form.genderTarget,
    master_product_id: form.masterProductId || null,
  }
}

export function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= rows.length) return rows
  const next = rows.slice()
  const item = next.splice(from, 1)
  next.splice(to, 0, ...item)
  return next
}
