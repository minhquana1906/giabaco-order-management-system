import { useState } from 'react'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { productionApi, type Assignment, type AssignmentChange, type AssignmentInput, type StepStatus } from './api'
import { ChangeLog } from './AssignmentRow'
import { localDateTime, statusLabels, touch, useProductionWrite } from './shared'

interface InternalValues { status: StepStatus; assignee: string; deadline: string; actualAt: string; content: string }

const empty: InternalValues = { status: 'pending', assignee: '', deadline: '', actualAt: '', content: '' }

const valuesOf = (a?: Assignment): InternalValues => a ? { status: a.status, assignee: a.assignee ?? '', deadline: a.deadline ?? '', actualAt: localDateTime(a.actual_at), content: a.content ?? '' } : empty

const iso = (local: string) => local ? new Date(local).toISOString() : null

/** Changed fields only, mirroring the partner edit form. */
export function internalChanges(a: Assignment, v: InternalValues): AssignmentChange {
  const before = valuesOf(a)
  const change: AssignmentChange = {}
  if (v.status !== before.status) change.status = v.status
  if (v.assignee !== before.assignee) change.assignee = v.assignee.trim() || null
  if (v.deadline !== before.deadline) change.deadline = v.deadline || null
  if (v.actualAt !== before.actualAt) change.actual_at = iso(v.actualAt)
  if (v.content !== before.content) change.content = v.content || null
  return change
}

function InternalForm({ campaignId, position, assignment }: { campaignId: string; position: number; assignment?: Assignment }) {
  const [values, setValues] = useState(valuesOf(assignment))
  const set = (patch: Partial<InternalValues>) => setValues({ ...values, ...patch })
  const save = useProductionWrite((body: { create: AssignmentInput } | { id: string; change: AssignmentChange }) => 'create' in body ? productionApi.createAssignment(body.create) : productionApi.updateAssignment(body.id, body.change))
  const unchanged = !!assignment && Object.keys(internalChanges(assignment, values)).length === 0
  const id = `internal-${position}`
  const submit = () => save.mutate(assignment
    ? { id: assignment.id, change: internalChanges(assignment, values) }
    : { create: { campaign_id: campaignId, step_position: position, assignee: values.assignee.trim() || null, status: values.status, deadline: values.deadline || null, actual_at: iso(values.actualAt), content: values.content || null } })
  return <form className="grid min-w-0 gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]" onSubmit={(e) => { e.preventDefault(); submit() }}>
    <Field id={`${id}-status`} label="Trạng thái">{(control) => <NativeSelect {...control} value={values.status} onChange={(e) => set({ status: e.target.value as StepStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
    <Field id={`${id}-assignee`} label="Người phụ trách">{(control) => <Input {...control} className={touch} maxLength={200} value={values.assignee} onChange={(e) => set({ assignee: e.target.value })} />}</Field>
    <Field id={`${id}-deadline`} label="Hạn riêng">{(control) => <Input {...control} className={touch} type="date" value={values.deadline} onChange={(e) => set({ deadline: e.target.value })} />}</Field>
    <Field id={`${id}-actual`} label="Ngày giờ thực tế">{(control) => <Input {...control} className={touch} type="datetime-local" value={values.actualAt} onChange={(e) => set({ actualAt: e.target.value })} />}</Field>
    <Field className="sm:col-span-2" id={`${id}-content`} label="Nội dung">{(control) => <Input {...control} className={touch} maxLength={10000} value={values.content} onChange={(e) => set({ content: e.target.value })} />}</Field>
    <div className="flex sm:col-span-2 sm:justify-end"><Button className={`w-full sm:w-auto ${touch}`} disabled={save.isPending || unchanged}>Lưu</Button></div>
  </form>
}

export function InternalStep({ campaignId, position, assignment }: { campaignId: string; position: number; assignment?: Assignment }) {
  const [log, setLog] = useState(false)
  return <div className="space-y-4">
    <InternalForm key={JSON.stringify(valuesOf(assignment))} campaignId={campaignId} position={position} assignment={assignment} />
    {assignment && <div className="space-y-3 border-t border-hairline pt-3">
      <Button variant="outline" className={touch} aria-expanded={log} onClick={() => setLog(!log)}>Lịch sử thay đổi</Button>
      {log && <ChangeLog id={assignment.id} />}
    </div>}
  </div>
}
