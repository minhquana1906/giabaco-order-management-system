import type { School as AdminSchool, SchoolClass } from '@/features/catalog/api'
import type { DataSource } from '@/features/parent_portal/api'
import { http } from '@/lib/http'

export type School = Pick<AdminSchool, 'id' | 'name'>

export interface ParentAccount {
  id: string
  full_name: string
  email: string
  phone: string | null
}

export interface RegisterBody {
  full_name: string
  phone: string
  email: string
  password: string
}

export const parentAuthApi = {
  me: () => http.get<ParentAccount>('/parent/auth/me'),
  register: (body: RegisterBody) => http.post<ParentAccount>('/parent/auth/register', body),
  login: (body: { identifier: string; password: string }) => http.post<ParentAccount>('/parent/auth/login', body),
  logout: () => http.post<void>('/parent/auth/logout'),
  forgot: (email: string) => http.post<{ accepted: boolean }>('/parent/auth/forgot', { email }),
  reset: (body: { token: string; password: string }) => http.post<void>('/parent/auth/reset', body),
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
  order_summary: OrderSummary | null
  campaign_open: boolean
}

export interface OrderSummary {
  items: number
  amount: number
  has_unpriced: boolean
  status: string
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
