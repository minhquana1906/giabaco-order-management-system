import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime } from '@/lib/format'
import type { ActivityEvent, Assignment, Demand, History, ProgressStep, StepState, StepStatus } from './api'

const SAVE_ERROR_MESSAGE = 'Chưa lưu được thay đổi. Vui lòng thử lại sau ít phút.'

export const productionKeys = { all: ['production'] as const, me: () => ['production', 'me'] as const }

export function useProductionWrite<V>(write: (value: V) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (value: V) => write(value),
    onSuccess: () => { void client.invalidateQueries({ queryKey: productionKeys.all, predicate: (q) => q.queryKey[1] !== 'me' }) },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : SAVE_ERROR_MESSAGE),
  })
}

/** Touch-friendly control height: 44px on phones, compact from md. */
export const touch = 'h-11 md:h-10'

export const statusLabels = { pending: 'Chưa bắt đầu', in_progress: 'Đang thực hiện', completed: 'Hoàn thành' } as const

const statusVariants = { pending: 'secondary', in_progress: 'info', completed: 'success' } as const

export function StatusBadge({ status }: { status: StepStatus }) {
  return <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
}

export const stateLabels = { unassigned: 'Chưa phân công', in_progress: 'Đang thực hiện', completed: 'Hoàn thành' } as const

const stateVariants = { unassigned: 'secondary', in_progress: 'info', completed: 'success' } as const

export function StepStateBadge({ state }: { state: StepState }) {
  return <Badge variant={stateVariants[state]}>{stateLabels[state]}</Badge>
}

export function OverdueBadge() {
  return <Badge variant="danger"><TriangleAlert aria-hidden="true" />Quá hạn</Badge>
}

const stepNumberTones = { pending: 'bg-secondary text-secondary-foreground', unassigned: 'bg-secondary text-secondary-foreground', in_progress: 'bg-info-soft text-info-ink', completed: 'bg-success-soft text-success-ink' } as const

/** Round step marker; tone follows the state, overdue wins with danger. */
export function StepNumber({ position, state, overdue = false, className }: { position: number; state: StepStatus | StepState; overdue?: boolean; className?: string }) {
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums', overdue ? 'bg-danger-soft text-danger-ink' : stepNumberTones[state], className)}>
    {state === 'completed' && !overdue ? <Check aria-hidden="true" className="size-4" /> : position}
  </span>
}

/** Deadline line: danger ink with an icon when overdue, muted otherwise. */
export function DeadlineText({ overdue, className, children }: { overdue: boolean; className?: string; children: ReactNode }) {
  return <p className={cn('flex items-center gap-1.5 text-sm', overdue ? 'font-medium text-danger-ink' : 'text-muted-foreground', className)}>
    {overdue && <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />}{children}
  </p>
}

export function actorLabel(actor: string) {
  return actor.startsWith('production_staff:') ? 'Đối tác' : actor
}

export const auditActionLabels: Record<string, string> = { create: 'Phân công', update: 'Chỉnh sửa phân công', update_progress: 'Cập nhật tiến độ', delete: 'Hủy phân công' }

export function dateLabel(value: string | null) {
  if (!value) return 'Chưa đặt'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const auditLabels: Record<string, string> = { quantity: 'Số lượng', deadline: 'Hạn', status: 'Trạng thái', content: 'Nội dung', actual_at: 'Thời điểm thực tế', facility_id: 'Đối tác', product_id: 'Sản phẩm' }

const changedIds: Record<string, string> = { facility_id: 'đã đổi đối tác', product_id: 'đã đổi sản phẩm' }

function auditValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return key === 'deadline' ? 'Chưa đặt' : '—'
  if (key === 'status') return statusLabels[value as StepStatus] ?? String(value)
  if (key === 'deadline') return dateLabel(String(value))
  if (key === 'actual_at') return new Date(String(value)).toLocaleString('vi-VN')
  return String(value)
}

/** Human-readable field changes of one audit entry; raw ids are reduced to a changed notice. */
export function auditChanges(before: unknown, after: unknown) {
  const from = (before ?? {}) as Record<string, unknown>
  const to = (after ?? {}) as Record<string, unknown>
  return Object.keys(auditLabels).filter((key) => key in to && (!before || from[key] !== to[key])).map((key) => ({
    key,
    label: auditLabels[key]!,
    from: before && !(key in changedIds) ? auditValue(key, from[key]) : null,
    to: key in changedIds ? (before ? changedIds[key]! : null) : auditValue(key, to[key]),
  })).filter((change) => change.to !== null)
}

/** Steps whose assignments are split per product and compared with ordered quantities. */
export const DEMAND_STEPS: readonly number[] = [6, 7, 8, 9]

export interface DemandRow { product_id: string; product_name: string; needed: number; assigned: number; remaining: number }

/** Ordered vs assigned quantity per product; a negative `remaining` means over-assigned. */
export function demandRows(demand: Demand[], assignments: Assignment[]): DemandRow[] {
  return demand.map((item) => {
    const assigned = assignments.reduce((sum, a) => sum + (a.product_id === item.product_id ? (a.quantity ?? 0) : 0), 0)
    return { product_id: item.product_id, product_name: item.product_name, needed: item.ordered_qty, assigned, remaining: item.ordered_qty - assigned }
  })
}

/** Rows of the demand table: products with an assignment in the step plus those the admin added explicitly. */
export function listedDemandRows(rows: DemandRow[], assignments: Assignment[], added: string[]): DemandRow[] {
  return rows.filter((row) => added.includes(row.product_id) || assignments.some((a) => a.product_id === row.product_id))
}

export interface ReconcileCell { completed: number; assigned: number; tone: 'none' | 'short' | 'over' }
export interface ReconcileRow { product_id: string; product_name: string; ordered: number; cells: ReconcileCell[] }

/** Per product: ordered quantity and completed/assigned quantity at each of the stages in DEMAND_STEPS. */
export function reconcileRows(demand: Demand[], steps: ProgressStep[]): ReconcileRow[] {
  const products = new Map(demand.map((d) => [d.product_id, { name: d.product_name, ordered: d.ordered_qty }]))
  for (const step of steps) for (const a of step.assignments) if (a.product_id && !products.has(a.product_id)) products.set(a.product_id, { name: a.product_name ?? '', ordered: 0 })
  return [...products].flatMap(([id, { name, ordered }]) => {
    const cells = DEMAND_STEPS.map((position): ReconcileCell => {
      const own = (steps.find((s) => s.position === position)?.assignments ?? []).filter((a) => a.product_id === id)
      const assigned = own.reduce((sum, a) => sum + (a.quantity ?? 0), 0)
      const completed = own.reduce((sum, a) => sum + (a.status === 'completed' ? (a.quantity ?? 0) : 0), 0)
      const tone = assigned > ordered ? 'over' : own.length > 0 && own.every((a) => a.status === 'completed') && completed < ordered ? 'short' : 'none'
      return { completed, assigned, tone }
    })
    return ordered > 0 || cells.some((c) => c.assigned > 0) ? [{ product_id: id, product_name: name, ordered, cells }] : []
  })
}

export interface WideCell { assigned: number; completed: number }

/** Per stage in DEMAND_STEPS: assignments that cover the whole campaign instead of one product. */
export function wideCoverage(steps: ProgressStep[]): WideCell[] {
  return DEMAND_STEPS.map((position) => {
    const wide = (steps.find((s) => s.position === position)?.assignments ?? []).filter((a) => a.product_id === null)
    return { assigned: wide.length, completed: wide.filter((a) => a.status === 'completed').length }
  })
}

export interface CampaignSummary { done: number; total: number; overdue: number; current: ProgressStep | null; completedOn: string | null }

export function summarizeCampaign(steps: ProgressStep[]): CampaignSummary {
  const done = steps.filter((s) => s.state === 'completed').length
  const latest = steps.flatMap((s) => s.assignments.map((a) => a.actual_at)).filter((v): v is string => !!v).sort().pop() ?? null
  return { done, total: steps.length, overdue: steps.filter((s) => s.overdue).length, current: steps.find((s) => s.state !== 'completed') ?? null, completedOn: latest && formatDate(latest) }
}

/** One-line description of an activity event. */
export function activitySentence(e: ActivityEvent) {
  const step = e.step_position === null ? e.step_name : `bước ${e.step_position}`
  const who = e.partner ?? 'Đối tác'
  const product = e.product_name ? ` · ${e.product_name}` : ''
  switch (e.action) {
    case 'create': return `Phân công ${e.partner ?? 'đối tác'} cho ${step}${product}`
    case 'update': return `Chỉnh sửa phân công ${e.partner ?? ''} ở ${step}${product}`.replace('  ', ' ')
    case 'update_progress': return `${who} cập nhật ${step}${product}${e.status ? ` → ${statusLabels[e.status]}` : ''}`
    case 'delete': return `Hủy phân công ${e.partner ?? ''} ở ${step}${product}`.replace('  ', ' ')
    case 'mode': return `Đổi cách thực hiện ${step}${e.note ? ` → ${e.note}` : ''}`
  }
}

/** ISO instant to the `datetime-local` input value in the browser time zone. */
export function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function AssignmentHistory({ history }: { history: History[] }) {
  return history.length ? <ul className="space-y-2">{history.map((entry) => <li key={entry.id} className="space-y-0.5 rounded-md bg-muted/50 p-3 text-sm">
    <p className="font-medium">{formatDateTime(entry.at)} · {actorLabel(entry.actor)} · {statusLabels[entry.status]}</p>
    <p className="text-muted-foreground">Nội dung: {entry.content || '—'} · Ngày giờ thực tế: {formatDateTime(entry.actual_at)} · Hạn: {dateLabel(entry.deadline)}</p>
  </li>)}</ul> : <p className="text-sm text-muted-foreground">Chưa có cập nhật.</p>
}
