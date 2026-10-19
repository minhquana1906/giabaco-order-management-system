import type { Fit } from '@/lib/fit'
import { http } from '@/lib/http'

export type Gender = 'MALE' | 'FEMALE'

export interface TrialIn {
  id: string | null
  product_code: string
  size_label: string
  fit: Fit
  note: string | null
}

export interface StudentIn {
  school_id: string
  class_id: string
  full_name: string
  dob: string
  gender: Gender
  height_cm: number
  weight_kg: number
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  trials: TrialIn[]
  force: boolean
}

export interface StudentTrial {
  id: string
  product_code: string
  product_name: string
  size_label: string
  suggested_size_label: string | null
  fit: Fit
  note: string | null
  tried_at: string
}

export interface ParentChoice {
  product_code: string
  product_name: string
  size_label: string
  chosen_at: string
}

export type DataSource = 'ADMIN_MEASURED' | 'PARENT_DECLARED'

export interface LinkedParent {
  parent_id: string
  full_name: string
  email: string | null
  phone: string | null
  origin: string
  linked_at: string
}

export interface StudentDetail {
  id: string
  full_name: string
  dob: string
  gender: Gender
  height_cm: number
  weight_kg: number
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  school: { id: string; name: string }
  class: { id: string; name: string; grade: number }
  portal_token: string
  portal_url: string
  data_source: DataSource
  measured_at: string
  created_at: string
  updated_at: string
  trials: StudentTrial[]
  derived_sizes: Record<string, string | null>
  parent_choices: ParentChoice[]
  linked_parents: LinkedParent[]
}

export interface StudentListItem {
  id: string
  full_name: string
  gender: Gender
  school: { id: string; name: string }
  class: { id: string; name: string; grade: number }
  height_cm: number
  weight_kg: number
  parent_phone: string | null
  data_source: DataSource
  derived_sizes: Record<string, string | null>
  trial_count: number
  has_note: boolean
  created_at: string
}

export interface StudentsPage {
  items: StudentListItem[]
  total: number
  page: number
  page_size: number
}

export interface StudentListParams {
  school_id?: string
  grade?: number
  class_id?: string
  gender?: Gender
  product?: string
  size?: string
  q?: string
  page?: number
}

export const STUDENTS_PAGE_SIZE = 50

export const studentsApi = {
  list: (params: StudentListParams, signal?: AbortSignal) =>
    http.get<StudentsPage>('/students', { ...params, page_size: STUDENTS_PAGE_SIZE }, signal),
  get: (id: string, signal?: AbortSignal) => http.get<StudentDetail>(`/students/${id}`, undefined, signal),
  create: (body: StudentIn) => http.post<StudentDetail>('/students', body),
  update: (id: string, body: StudentIn) => http.put<StudentDetail>(`/students/${id}`, body),
  remove: (id: string) => http.delete(`/students/${id}`),
  unlinkParent: (id: string, parentId: string) => http.delete(`/students/${id}/parents/${parentId}`),
}
