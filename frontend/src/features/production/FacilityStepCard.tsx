import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Assignment, StepStatus } from './api'
import { FacilityUpdateForm } from './FacilityUpdateForm'
import { dateLabel, DeadlineText, OverdueBadge, StatusBadge, StepNumber, touch } from './shared'

export interface FacilityStep { position: number; name: string; items: Assignment[] }

/** A step is done when every assignment is, started when any has moved past pending. */
export function stepStatus(items: Assignment[]): StepStatus {
  if (items.every((a) => a.status === 'completed')) return 'completed'
  return items.some((a) => a.status !== 'pending') ? 'in_progress' : 'pending'
}

function AssignmentItem({ assignment: a }: { assignment: Assignment }) {
  const [open, setOpen] = useState(false)
  return <li className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-1">
        <p className="text-[15px] font-medium break-words">{a.product_name ?? 'Cả đợt'}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {a.quantity !== null && <p className="text-sm text-muted-foreground">Số lượng <span className="font-semibold tabular-nums text-foreground">{a.quantity}</span></p>}
          <DeadlineText overdue={a.overdue}>Hạn: {dateLabel(a.effective_deadline)}</DeadlineText>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={a.status} />{a.overdue && <OverdueBadge />}</div>
    </div>
    {a.content && <p className="mt-2 max-w-[65ch] text-sm break-words">{a.content}</p>}
    <Button variant="outline" className={cn('mt-3 w-full sm:w-auto', touch)} aria-expanded={open} onClick={() => setOpen(!open)}>
      Cập nhật tiến độ<ChevronDown aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
    </Button>
    {open && <FacilityUpdateForm assignment={a} />}
  </li>
}

export function FacilityStepCard({ step }: { step: FacilityStep }) {
  const status = stepStatus(step.items)
  const done = step.items.filter((a) => a.status === 'completed').length
  const headingId = useId()
  return <section aria-labelledby={headingId} className="overflow-hidden rounded-lg border border-hairline bg-card">
    <header className="flex items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
      <StepNumber position={step.position} state={status} overdue={step.items.some((a) => a.overdue)} />
      <div className="min-w-0">
        <h2 id={headingId} className="text-base leading-snug font-semibold text-navy break-words">{step.name}</h2>
        <p className="text-[13px] text-muted-foreground tabular-nums">Bước {step.position} · {done}/{step.items.length} hoàn thành</p>
      </div>
    </header>
    <ul className="divide-y divide-hairline">{step.items.map((a) => <AssignmentItem key={`${a.id}-${a.status}-${a.content}-${a.actual_at}`} assignment={a} />)}</ul>
  </section>
}
