import type { School, SchoolClass } from '@/features/catalog/api'
import type { DataSource } from '@/features/parent_portal/api'
import { http } from '@/lib/http'

export interface ParentAccount {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

export interface RegisterBody {
  full_name: string
  email?: string
  phone?: string
  password: string
}

export const parentAuthApi = {
  me: () => http.get<ParentAccount>('/parent/auth/me'),
  register: (body: RegisterBody) => http.post<ParentAccount>('/parent/auth/register', body),
  login: (body: { identifier: string; password: string }) => http.post<ParentAccount>('/parent/auth/login', body),
  logout: () => http.post<void>('/parent/auth/logout'),
}

export type Gender = 'MALE' | 'FEMALE'

export interface ChildSummary {
  student_id: string
  full_name: string
  school_id: string
  school_name: string
  class_id: string
  class_name: string
  gender: Gender
  data_source: DataSource
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  choices: ChildChoice[]
}

export interface ChildChoice {
  product_code: string
  product_name: string
  size_label: string
}

export interface ChildKey {
  school_id: string
  full_name: string
  dob: string
}

export type LookupResponse =
  | { found: false }
  | { found: true; ambiguous: true }
  | { found: true; ambiguous: false; full_name: string; school_name: string; class_name: string }

export interface DeclaredBody {
  class_id: string
  gender: Gender
  height_cm: number
  weight_kg: number
  parent_phone: string
  parent_name: string | null
  parent_email: string | null
}

export type CreateChildBody = ChildKey & DeclaredBody

export const parentChildrenApi = {
  list: (signal?: AbortSignal) => http.get<ChildSummary[]>('/parent/children', undefined, signal),
  lookup: (body: ChildKey) => http.post<LookupResponse>('/parent/children/lookup', body),
  claim: (body: ChildKey) => http.post<ChildSummary>('/parent/children/claim', body),
  create: (body: CreateChildBody) => http.post<ChildSummary>('/parent/children', body),
  update: (studentId: string, body: DeclaredBody) =>
    http.put<ChildSummary>(`/parent/children/${encodeURIComponent(studentId)}`, body),
  schools: (signal?: AbortSignal) => http.get<School[]>('/parent/schools', undefined, signal),
  classes: (schoolId: string, signal?: AbortSignal) =>
    http.get<SchoolClass[]>(`/parent/schools/${encodeURIComponent(schoolId)}/classes`, undefined, signal),
}
