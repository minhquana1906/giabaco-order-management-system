import { http } from '@/lib/http'

export interface Product {
  id: string
  code: string
  name: string
  sizes: string[]
  has_size_guide: boolean
}

export interface School {
  id: string
  name: string
  code: string
}

export interface SchoolClass {
  id: string
  school_id: string
  grade: number
  name: string
}

export type SizeSuggestions = Record<string, string | null>

export const catalogApi = {
  products: (signal?: AbortSignal) => http.get<Product[]>('/products', undefined, signal),
  schools: (signal?: AbortSignal) => http.get<School[]>('/schools', undefined, signal),
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
