import { useState } from 'react'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { productionApi, type Assignment, type StepStatus } from './api'
import { AssignmentHistory, localDateTime, statusLabels, touch, useProductionWrite } from './shared'

/** Progress form plus change history of one assignment, shown when its row is expanded. */
export function FacilityUpdateForm({ assignment: a }: { assignment: Assignment }) {
  const [status, setStatus] = useState(a.status)
  const [content, setContent] = useState(a.content ?? '')
  const [actualAt, setActualAt] = useState(localDateTime(a.actual_at))
  const [showHistory, setShowHistory] = useState(false)
  const save = useProductionWrite((body: { status: StepStatus; content: string | null; actual_at: string | null }) => productionApi.updateProgress(a.id, body))
  const unchanged = status === a.status && content === (a.content ?? '') && actualAt === localDateTime(a.actual_at)
  return <div className="mt-4 space-y-4 border-t border-hairline pt-4">
    <form className="grid min-w-0 gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]" onSubmit={(e) => { e.preventDefault(); save.mutate({ status, content: content || null, actual_at: actualAt ? new Date(actualAt).toISOString() : null }) }}>
      <Field id={`status-${a.id}`} label="Trạng thái">{(control) => <NativeSelect {...control} value={status} onChange={(e) => setStatus(e.target.value as StepStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
      <Field id={`actual-${a.id}`} label="Ngày giờ thực tế">{(control) => <Input {...control} className={touch} type="datetime-local" value={actualAt} onChange={(e) => setActualAt(e.target.value)} />}</Field>
      <Field className="sm:col-span-2" id={`content-${a.id}`} label="Nội dung">{(control) => <Input {...control} className={touch} maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} />}</Field>
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" className={`self-start text-muted-foreground ${touch}`} aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>Lịch sử cập nhật</Button>
        <Button className={`w-full sm:w-auto ${touch}`} disabled={save.isPending || unchanged}>Lưu cập nhật</Button>
      </div>
    </form>
    {showHistory && <AssignmentHistory history={a.history} />}
  </div>
}
