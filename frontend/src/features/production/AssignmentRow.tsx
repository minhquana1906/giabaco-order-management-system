import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/format'
import { productionApi, type Assignment, type AssignmentChange, type Facility } from './api'
import { AssignmentForm, assignmentChanges, valuesOf } from './AssignmentForm'
import { actorLabel, auditActionLabels, auditChanges, dateLabel, DeadlineText, OverdueBadge, StatusBadge, touch, useProductionWrite } from './shared'

export function ChangeLog({ id }: { id: string }) {
  const audit = useQuery({ queryKey: ['production', 'audit', id], queryFn: ({ signal }) => productionApi.audit(id, signal) })
  if (audit.isPending) return <LoadingRows rows={2} />
  if (audit.isError) return <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
  return audit.data.length ? <ul className="space-y-2">{audit.data.map((entry) => <li key={entry.id} className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
    <p className="font-medium">{formatDateTime(entry.at)} · {actorLabel(entry.actor)} · {auditActionLabels[entry.action] ?? entry.action}</p>
    <ul className="space-y-0.5 text-muted-foreground">{auditChanges(entry.before, entry.after).map((change) => <li key={change.key}><span className="font-medium text-foreground">{change.label}:</span> {change.from !== null ? `${change.from} → ${change.to}` : change.to}</li>)}</ul>
  </li>)}</ul> : <p className="text-sm text-muted-foreground">Chưa có thay đổi.</p>
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-0.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm break-words">{children}</dd></div>
}

type Panel = 'edit' | 'log' | null

export function AssignmentRow({ assignment: a, facilities, products }: { assignment: Assignment; facilities: Facility[]; products: { id: string; name: string }[] }) {
  const [panel, setPanel] = useState<Panel>(null)
  const [confirming, setConfirming] = useState(false)
  const update = useProductionWrite((body: AssignmentChange) => productionApi.updateAssignment(a.id, body))
  const remove = useProductionWrite<void>(() => productionApi.deleteAssignment(a.id))
  const toggle = (next: Exclude<Panel, null>) => setPanel(panel === next ? null : next)
  const last = a.history[a.history.length - 1]
  return <li className="space-y-4 rounded-md border border-hairline bg-card p-4">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h4 className="font-semibold">{a.facility_name ?? a.assignee}</h4><StatusBadge status={a.status} />{a.overdue && <OverdueBadge />}
    </div>
    <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-3 md:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]">
      <Item label="Sản phẩm">{a.product_name ?? 'Cả đợt'}</Item>
      <Item label="Số lượng">{a.quantity ?? '—'}</Item>
      <Item label="Hạn"><DeadlineText overdue={a.overdue} className="gap-1">{dateLabel(a.effective_deadline)}{a.deadline ? ' (hạn riêng)' : ''}</DeadlineText></Item>
      <Item label="Cập nhật gần nhất">{last ? `${formatDateTime(last.at)} · ${actorLabel(last.actor)}` : '—'}</Item>
      {a.content && <Item label="Nội dung">{a.content}</Item>}
    </dl>
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
      <Button variant="outline" className={touch} aria-expanded={panel === 'edit'} onClick={() => toggle('edit')}>Sửa</Button>
      <Button variant="outline" className={touch} aria-expanded={panel === 'log'} onClick={() => toggle('log')}>Lịch sử thay đổi</Button>
      <Button variant="ghost" className={`ml-auto text-danger-ink ${touch}`} onClick={() => setConfirming(true)}>Hủy phân công</Button>
    </div>
    {panel === 'edit' && <div className="border-t border-hairline pt-4"><AssignmentForm key={JSON.stringify(valuesOf(a))} idPrefix={`edit-${a.id}`} facilities={facilities} products={products} initial={a} submitLabel="Lưu thay đổi" pending={update.isPending} onCancel={() => setPanel(null)}
      onSubmit={(values) => update.mutate(assignmentChanges(a, values), { onSuccess: () => setPanel(null) })} /></div>}
    {panel === 'log' && <div className="border-t border-hairline pt-4"><ChangeLog id={a.id} /></div>}
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy phân công này?</DialogTitle>
          <DialogDescription>{a.facility_name ?? a.assignee} · {a.product_name ?? 'Cả đợt'} · Bước {a.step_position}. Phân công và lịch sử cập nhật tiến độ của đối tác sẽ không còn hiển thị.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className={touch} onClick={() => setConfirming(false)}>Giữ lại</Button>
          <Button variant="destructive" className={touch} disabled={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: () => setConfirming(false) })}>Xác nhận hủy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </li>
}
