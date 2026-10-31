import { http } from '@/lib/http'

export type GenderTarget = 'MALE' | 'FEMALE' | 'UNISEX'
export type ImageGender = 'MALE' | 'FEMALE'

export interface SizeGuideRow {
  size_label: string
  height_min_cm: number
  height_max_cm: number | null
  weight_min_kg: number
  weight_max_kg: number | null
}

export interface TailorMeasurement {
  key: string
  label: string
  instruction: string
  required: boolean
}

export interface MeasurementType {
  key: string
  label: string
}

export interface Product {
  id: string
  code: string
  name: string
  description: string | null
  sizes: string[]
  size_guide: SizeGuideRow[] | null
  tailor_measurements: TailorMeasurement[]
  colours: string[]
  gender_target: GenderTarget
  master_product_id: string | null
  active: boolean
  has_size_guide: boolean
  school_image_counts: Record<string, number>
}

export interface ProductBody {
  name: string
  description: string | null
  sizes: string[]
  size_guide: SizeGuideRow[] | null
  tailor_measurements: TailorMeasurement[]
  colours: string[]
  gender_target: GenderTarget
  master_product_id: string | null
}

export interface ProductInput extends ProductBody {
  code: string
}

export interface ProductUpdateInput extends ProductBody {
  active: boolean
}

export interface ColourOption {
  code: string
  label: string
  hex: string
}

export interface ProductImageRef {
  url: string
  width: number
  height: number
}

export interface ProductImage extends ProductImageRef {
  id: string
  school_id: string
  product_id: string
  gender: ImageGender
  colour: string
}

export interface School {
  id: string
  name: string
  code: string
  has_open_campaign: boolean
}

export interface SchoolClass {
  id: string
  school_id: string
  grade: number
  name: string
}

export type SizeSuggestions = Record<string, string | null>

export const catalogApi = {
  products: (includeInactive = false, signal?: AbortSignal) =>
    http.get<Product[]>('/products', includeInactive ? { include_inactive: true } : undefined, signal),
  product: (id: string, signal?: AbortSignal) => http.get<Product>(`/products/${id}`, undefined, signal),
  createProduct: (body: ProductInput) => http.post<Product>('/products', body),
  updateProduct: (id: string, body: ProductUpdateInput) => http.patch<Product>(`/products/${id}`, body),
  measurementTypes: (signal?: AbortSignal) =>
    http.get<MeasurementType[]>('/measurement-types', undefined, signal),
  createMeasurementType: (body: { label: string; confirm_similar?: boolean }) =>
    http.post<MeasurementType>('/measurement-types', body),
  renameMeasurementType: (key: string, label: string) =>
    http.patch<MeasurementType>(`/measurement-types/${key}`, { label }),
  colours: (signal?: AbortSignal) => http.get<ColourOption[]>('/product-colours', undefined, signal),
  /** Base products (GU-<SEG>-<PRODUCT>) from master data, for linking a sales product. */
  baseProducts: (signal?: AbortSignal) =>
    http.get<{ id: string; data: Record<string, string | null> }[]>('/master-data/products', undefined, signal),
  listImages: (id: string, schoolId: string, signal?: AbortSignal) =>
    http.get<ProductImage[]>(`/products/${id}/images`, { school_id: schoolId }, signal),
  uploadProductImage: (
    id: string,
    input: { school_id: string; gender: ImageGender; colour: string; file: File },
  ) => {
    const form = new FormData()
    form.set('school_id', input.school_id)
    form.set('gender', input.gender)
    form.set('colour', input.colour)
    form.set('file', input.file)
    return http.postForm<ProductImage>(`/products/${id}/images`, form)
  },
  deleteProductImage: (id: string, imageId: string) => http.delete(`/products/${id}/images/${imageId}`),
  schools: (signal?: AbortSignal) => http.get<School[]>('/schools', undefined, signal),
  schoolProducts: (schoolId: string, signal?: AbortSignal) =>
    http.get<Product[]>(`/schools/${schoolId}/products`, undefined, signal),
  classes: (schoolId: string, signal?: AbortSignal) =>
    http.get<SchoolClass[]>(`/schools/${schoolId}/classes`, undefined, signal),
  createSchool: (body: { name: string; code: string }) => http.post<School>('/schools', body),
  createClass: (schoolId: string, body: { grade: number; name: string }) =>
    http.post<SchoolClass>(`/schools/${schoolId}/classes`, body),
  updateSchool: (schoolId: string, body: { name: string }) =>
    http.patch<School>(`/schools/${schoolId}`, body),
  updateClass: (schoolId: string, classId: string, body: { grade: number; name: string }) =>
    http.patch<SchoolClass>(`/schools/${schoolId}/classes/${classId}`, body),
  sizeSuggestions: (params: { height_cm: number; weight_kg: number }, signal?: AbortSignal) =>
    http.get<SizeSuggestions>('/size-suggestions', params, signal),
}
