import { http } from '@/lib/http'

export interface Facility { id: string; code: string; name: string; active: boolean; main_stage: string | null }
export type StepMode = 'partners' | 'internal'
export interface TimelineStep { position: number; name: string; deadline: string | null; mode: StepMode }
export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type StepState = 'unassigned' | 'in_progress' | 'completed'
export interface History { id: string; at: string; actor: string; status: StepStatus; content: string | null; actual_at: string | null; deadline: string | null }
export interface Assignment {
  id: string; campaign_id: string; campaign_name: string; step_position: number; step_name: string
  facility_id: string | null; facility_name: string | null; assignee: string | null; step_mode: StepMode; product_id: string | null; product_name: string | null; quantity: number | null
  deadline: string | null; step_deadline: string | null; effective_deadline: string | null; overdue: boolean
  status: StepStatus; content: string | null; actual_at: string | null; history: History[]
}
export interface ProgressStep extends TimelineStep { state: StepState; overdue: boolean; assignments: Assignment[] }
export interface Demand { product_id: string; product_name: string; ordered_qty: number }
export interface Progress {
  campaign: { id: string; name: string; status: 'DRAFT' | 'OPEN' | 'LOCKED'; closes_at: string | null; submitted_orders: number }
  steps: ProgressStep[]
  demand: Demand[]
}
export interface AssignmentInput {
  campaign_id: string; step_position: number; facility_id?: string | null; product_id?: string | null; quantity?: number | null; deadline?: string | null
  assignee?: string | null; status?: StepStatus; content?: string | null; actual_at?: string | null
}
export interface AssignmentChange { facility_id?: string; assignee?: string | null; product_id?: string | null; quantity?: number | null; deadline?: string | null; status?: StepStatus; content?: string | null; actual_at?: string | null }
export interface ProgressUpdate { status: StepStatus; content: string | null; actual_at: string | null }
export interface ProductionSession { role: 'admin' | 'facility'; facility_id: string | null }
export type ActivityAction = 'create' | 'update' | 'update_progress' | 'delete' | 'mode'
export interface ActivityEvent {
  id: string; at: string; actor: string; action: ActivityAction; step_position: number | null; step_name: string
  partner: string | null; product_name: string | null; status: StepStatus | null; note: string | null
}
export interface AuditEntry { id: string; at: string; actor: string; action: string; before: unknown; after: unknown }

export const productionApi = {
  login: (body: { username: string; password: string }) => http.post<ProductionSession>('/production/login', body),
  logout: () => http.post<void>('/production/logout'),
  me: (signal?: AbortSignal) => http.get<ProductionSession>('/production/me', undefined, signal),
  facilities: (signal?: AbortSignal) => http.get<Facility[]>('/production/facilities', undefined, signal),
  timeline: (campaignId: string, signal?: AbortSignal) => http.get<{ steps: TimelineStep[] }>(`/production/campaigns/${campaignId}/timeline`, undefined, signal),
  updateTimeline: (campaignId: string, steps: Omit<TimelineStep, 'mode'>[]) => http.put<{ steps: TimelineStep[] }>(`/production/campaigns/${campaignId}/timeline`, { steps }),
  setStepMode: (campaignId: string, position: number, mode: StepMode) => http.patch<TimelineStep>(`/production/campaigns/${campaignId}/steps/${position}`, { mode }),
  activity: (campaignId: string, limit = 50, signal?: AbortSignal) => http.get<ActivityEvent[]>(`/production/campaigns/${campaignId}/activity`, { limit }, signal),
  progress: (campaignId: string, signal?: AbortSignal) => http.get<Progress>(`/production/campaigns/${campaignId}/progress`, undefined, signal),
  assignments: (filters?: { campaign_id?: string; facility_id?: string; limit?: number; offset?: number }, signal?: AbortSignal) => http.get<Assignment[]>('/production/assignments', filters, signal),
  createAssignment: (body: AssignmentInput) => http.post<Assignment>('/production/assignments', body),
  updateAssignment: (id: string, body: AssignmentChange) => http.patch<Assignment>(`/production/assignments/${id}`, body),
  updateProgress: (id: string, body: ProgressUpdate) => http.put<Assignment>(`/production/assignments/${id}/progress`, body),
  deleteAssignment: (id: string) => http.delete<void>(`/production/assignments/${id}`),
  audit: (id: string, signal?: AbortSignal) => http.get<AuditEntry[]>(`/production/assignments/${id}/audit`, undefined, signal),
}
