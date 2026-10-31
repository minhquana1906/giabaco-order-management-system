import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, X } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCampaigns } from '@/features/campaigns/hooks'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { productionApi, type Assignment, type AssignmentInput, type Facility, type Progress, type ProgressStep, type StepMode, type TimelineStep } from './api'
import { AssignmentForm } from './AssignmentForm'
import { AssignmentRow } from './AssignmentRow'
import { InternalStep } from './InternalStepForm'
import { ActivityFeed, CampaignSummary, Reconciliation } from './ProductionOverview'
import { DEMAND_STEPS, demandRows, dateLabel, listedDemandRows, type DemandRow, OverdueBadge, StepNumber, StepStateBadge, touch, useProductionWrite } from './shared'

function TimelineEditor({ campaignId, initial }: { campaignId: string; initial: TimelineStep[] }) {
  const [steps, setSteps] = useState(initial)
  const save = useProductionWrite((value: TimelineStep[]) => productionApi.updateTimeline(campaignId, value.map(({ position, name, deadline }) => ({ position, name, deadline }))))
  const change = (index: number, patch: Partial<TimelineStep>) => setSteps(steps.map((s, i) => i === index ? { ...s, ...patch } : s))
  return <form className="space-y-4 rounded-md border border-hairline bg-card p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(steps) }}>
    <div aria-hidden="true" className="hidden grid-cols-[2rem_minmax(0,1fr)_11rem] gap-x-3 text-sm font-medium text-muted-foreground sm:grid"><span /><span>Tên bước</span><span>Hạn</span></div>
    <ol className="space-y-3">
      {steps.map((step, index) => <li key={step.position} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[2rem_minmax(0,1fr)_11rem]">
        <div className={cn('row-span-2 flex flex-col items-center sm:row-span-1', index < steps.length - 1 && '-mb-3')}>
          <span className={cn('flex items-center', touch)}><span className="grid size-8 place-items-center rounded-full bg-secondary text-sm font-semibold tabular-nums text-secondary-foreground">{step.position}</span></span>
          {index < steps.length - 1 && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
        </div>
        <div>
          <Label htmlFor={`step-name-${step.position}`} className="sr-only">Tên bước {step.position}</Label>
          <Input id={`step-name-${step.position}`} className={touch} required value={step.name} onChange={(e) => change(index, { name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`step-date-${step.position}`} className="text-sm text-muted-foreground sm:sr-only">Hạn bước {step.position}</Label>
          <Input id={`step-date-${step.position}`} className={touch} type="date" value={step.deadline ?? ''} onChange={(e) => change(index, { deadline: e.target.value || null })} />
        </div>
      </li>)}
    </ol>
    <div className="flex justify-end border-t border-hairline pt-4"><Button className={cn('w-full sm:w-auto', touch)} disabled={save.isPending}>Lưu tiến độ</Button></div>
  </form>
}

const campaignStatusLabels = { DRAFT: 'Đợt đang soạn', OPEN: 'Đợt đang mở', LOCKED: 'Đợt đã khóa' } as const

function TimelineSection({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false)
  const timeline = useQuery({ queryKey: ['production', 'timeline', campaignId], queryFn: ({ signal }) => productionApi.timeline(campaignId, signal), enabled: open })
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold"><button type="button" aria-expanded={open} aria-controls={open ? 'timeline-panel' : undefined} className={cn('-mx-2 flex items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background', touch)} onClick={() => setOpen(!open)}>
      Mốc thời gian cả đợt<ChevronDown aria-hidden="true" className={cn('size-5 text-lining transition-transform', open && 'rotate-180')} />
    </button></h2>
    {open && <div id="timeline-panel" className="space-y-3">
      <p className="max-w-[65ch] text-sm text-muted-foreground">Áp dụng cho cả đợt; đối tác có thể có hạn riêng.</p>
      {timeline.isPending ? <LoadingRows rows={4} /> : timeline.isError ? <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} /> : <TimelineEditor key={`${campaignId}-${JSON.stringify(timeline.data.steps)}`} campaignId={campaignId} initial={timeline.data.steps} />}
    </div>}
  </section>
}

function DemandHint({ rows, assignments }: { rows: DemandRow[]; assignments: Assignment[] }) {
  const [added, setAdded] = useState<string[]>([])
  const listed = listedDemandRows(rows, assignments, added)
  const addable = rows.filter((row) => !listed.some((l) => l.product_id === row.product_id))
  return <div className="space-y-3">
    {listed.length ? <div className="max-w-2xl overflow-x-auto rounded-md border border-hairline px-2 py-1">
      <Table className="min-w-[30rem] table-fixed">
        <colgroup><col /><col className="w-20" /><col className="w-32" /><col className="w-24" /></colgroup>
        <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent">
          <TableHead className="px-3 font-semibold">Sản phẩm</TableHead><TableHead className="px-3 text-right font-semibold">Cần</TableHead><TableHead className="px-3 text-right font-semibold">Đã phân công</TableHead><TableHead className="px-3 text-right font-semibold">Còn lại</TableHead>
        </TableRow></TableHeader>
        <TableBody>{listed.map((row) => {
          const hasAssignment = assignments.some((a) => a.product_id === row.product_id)
          const done = hasAssignment && row.remaining === 0
          return <TableRow key={row.product_id} className={cn(done && 'bg-success-soft/40 hover:bg-success-soft/60', row.remaining < 0 && 'bg-danger-soft/40 hover:bg-danger-soft/60')}>
            <TableCell className="px-3 py-2.5 whitespace-normal"><div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{row.product_name}</span>
              {!hasAssignment && <><Badge variant="outline">Chưa phân công</Badge><Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" title="Bỏ khỏi bảng" aria-label={`Bỏ ${row.product_name} khỏi bảng`} onClick={() => setAdded(added.filter((id) => id !== row.product_id))}><X aria-hidden="true" /></Button></>}
            </div></TableCell>
            <TableCell className="px-3 py-2.5 text-right tabular-nums">{row.needed}</TableCell>
            <TableCell className="px-3 py-2.5 text-right tabular-nums">{row.assigned}</TableCell>
            <TableCell className="px-3 py-2.5 text-right tabular-nums">{row.remaining < 0
              ? <Badge variant="danger">Vượt {-row.remaining}</Badge>
              : done ? <span className="inline-flex items-center justify-end gap-1 font-semibold text-success-ink"><Check aria-hidden="true" className="size-4" />0</span>
              : <span className={cn(hasAssignment && 'font-semibold text-info-ink')}>{row.remaining}</span>}</TableCell>
          </TableRow>
        })}</TableBody>
      </Table>
    </div> : <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào trong bảng.</p>}
    {addable.length > 0 && <Field className="max-w-xs" id="demand-add" label="Thêm sản phẩm vào bảng">{(control) => <NativeSelect {...control} value="" onChange={(e) => e.target.value && setAdded([...added, e.target.value])}>
      <option value="">Chọn sản phẩm…</option>
      {addable.map((row) => <option key={row.product_id} value={row.product_id}>{row.product_name}</option>)}
    </NativeSelect>}</Field>}
  </div>
}

const modeLabels: Record<StepMode, string> = { partners: 'Giao đối tác', internal: 'Nội bộ Giabaco' }

function ModeSwitch({ campaignId, step }: { campaignId: string; step: ProgressStep }) {
  const change = useProductionWrite((mode: StepMode) => productionApi.setStepMode(campaignId, step.position, mode))
  return <div className="space-y-1.5">
    <p id={`mode-label-${step.position}`} className="text-sm font-medium">Cách thực hiện</p>
    <div role="group" aria-labelledby={`mode-label-${step.position}`} className="inline-flex max-w-full flex-wrap rounded-md border border-hairline p-0.5">
      {(Object.keys(modeLabels) as StepMode[]).map((mode) => <button key={mode} type="button" aria-pressed={step.mode === mode} disabled={change.isPending} className={cn('min-h-11 rounded px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-10', step.mode === mode ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted')} onClick={() => step.mode !== mode && change.mutate(mode)}>{modeLabels[mode]}</button>)}
    </div>
  </div>
}

function StepPanel({ id, campaignId, step, progress, facilities }: { id: string; campaignId: string; step: ProgressStep; progress: Progress; facilities: Facility[] }) {
  const [formKey, setFormKey] = useState(0)
  const create = useProductionWrite((body: AssignmentInput) => productionApi.createAssignment(body))
  const products = progress.demand.map((d) => ({ id: d.product_id, name: d.product_name }))
  const byProduct = DEMAND_STEPS.includes(step.position) ? demandRows(progress.demand, step.assignments) : null
  const suggest = byProduct ? Object.fromEntries(byProduct.map((row) => [row.product_id, row.remaining])) : undefined
  const { campaign } = progress
  return <div id={id} role="region" aria-label={`Chi tiết bước ${step.position}`} className="mt-3 space-y-5">
    <ModeSwitch campaignId={campaignId} step={step} />
    {step.position === 4 && <p className="rounded-md bg-muted/50 p-3 text-sm">{campaign.submitted_orders} đơn đã nộp · {campaignStatusLabels[campaign.status]} · {campaign.closes_at ? `Hạn đóng đợt ${formatDate(campaign.closes_at)}` : 'Chưa đặt hạn đóng đợt'}</p>}
    {step.mode === 'internal' ? <InternalStep campaignId={campaignId} position={step.position} assignment={step.assignments[0]} /> : <>
      {byProduct && progress.demand.length > 0 && <DemandHint rows={byProduct} assignments={step.assignments} />}
      {step.assignments.length ? <ul className="space-y-3">{step.assignments.map((a) => <AssignmentRow key={a.id} assignment={a} facilities={facilities} products={products} />)}</ul> : <p className="text-sm text-muted-foreground">Chưa có đối tác nào được phân công cho bước này.</p>}
      <div className="space-y-3 border-t border-hairline pt-4">
        <h3 className="font-semibold">Thêm đối tác</h3>
        <AssignmentForm key={formKey} idPrefix={`add-${step.position}`} facilities={facilities.filter((f) => f.active)} products={products} suggest={suggest} submitLabel="Thêm đối tác" pending={create.isPending}
          onSubmit={(v) => create.mutate({ campaign_id: campaignId, step_position: step.position, facility_id: v.facility, product_id: v.product || null, quantity: v.quantity ? Number(v.quantity) : null, deadline: v.deadline || null }, { onSuccess: () => setFormKey(formKey + 1) })} />
      </div>
    </>}
  </div>
}

function Stepper({ campaignId, progress, facilities }: { campaignId: string; progress: Progress; facilities: Facility[] }) {
  const [current, setCurrent] = useState<number | null>(null)
  return <ol>{progress.steps.map((step, index) => {
    const expanded = step.position === current
    const panelId = `step-panel-${step.position}`
    return <li key={step.position} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center pt-3">
        <StepNumber position={step.position} state={step.state} overdue={step.overdue} />
        {index < progress.steps.length - 1 && <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 pb-3">
        <button type="button" aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} className="flex min-h-11 w-full items-start gap-3 rounded-md border border-hairline bg-card p-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" onClick={() => setCurrent(expanded ? null : step.position)}>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5"><span className="font-semibold">{step.position}. {step.name}</span>{step.mode === 'internal' && <span className="text-xs text-muted-foreground">Nội bộ Giabaco</span>}<StepStateBadge state={step.state} />{step.overdue && <OverdueBadge />}</span>
            <span className="block text-sm text-muted-foreground">{step.deadline ? `Hạn đợt: ${dateLabel(step.deadline)}` : 'Chưa đặt hạn'}</span>
            {step.mode === 'internal' ? step.assignments[0]?.assignee && <span className="block text-sm">{step.assignments[0].assignee}</span> : step.assignments.length > 0 && <span className="flex min-w-0 flex-wrap gap-1.5">{step.assignments.map((a) => <Badge key={a.id} variant="outline" className="max-w-full justify-start whitespace-normal text-left break-words">{[a.facility_name, a.product_name, a.quantity === null ? null : `SL ${a.quantity}`].filter(Boolean).join(' · ')}</Badge>)}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0 text-lining transition-transform', expanded && 'rotate-180')} />
        </button>
        {expanded && <StepPanel id={panelId} campaignId={campaignId} step={step} progress={progress} facilities={facilities} />}
      </div>
    </li>
  })}</ol>
}

function CampaignProduction({ campaignId }: { campaignId: string }) {
  const progress = useQuery({ queryKey: ['production', 'progress', campaignId], queryFn: ({ signal }) => productionApi.progress(campaignId, signal) })
  const facilities = useQuery({ queryKey: ['production', 'facilities'], queryFn: ({ signal }) => productionApi.facilities(signal) })
  return <div className="space-y-6">
    {progress.data && <CampaignSummary progress={progress.data} />}
    <Tabs defaultValue="progress">
      <TabsList><TabsTrigger value="progress">Tiến độ</TabsTrigger><TabsTrigger value="reconcile">Đối soát số lượng</TabsTrigger><TabsTrigger value="activity">Hoạt động</TabsTrigger></TabsList>
      <TabsContent value="progress" className="space-y-8">
        <TimelineSection campaignId={campaignId} />
        <section className="space-y-4 border-t border-hairline pt-8">
          <h2 className="text-xl font-semibold">Tiến độ các bước</h2>
          {progress.isError || facilities.isError ? <ErrorState error={progress.error ?? facilities.error} onRetry={() => { void progress.refetch(); void facilities.refetch() }} /> : progress.isPending || facilities.isPending ? <LoadingRows rows={4} /> : <Stepper campaignId={campaignId} progress={progress.data} facilities={facilities.data} />}
        </section>
      </TabsContent>
      <TabsContent value="reconcile">
        {progress.isError ? <ErrorState error={progress.error} onRetry={() => void progress.refetch()} /> : progress.isPending ? <LoadingRows rows={4} /> : <Reconciliation progress={progress.data} />}
      </TabsContent>
      <TabsContent value="activity"><ActivityFeed campaignId={campaignId} /></TabsContent>
    </Tabs>
  </div>
}

export function AdminProductionPage() {
  const [chosen, setChosen] = useState('')
  const campaigns = useCampaigns(undefined)
  const campaignId = chosen || campaigns.data?.[0]?.id || ''
  return <div className="space-y-8"><PageHeader title="Tiến độ đợt sản xuất" />
    {campaigns.isPending ? <LoadingRows rows={1} /> : campaigns.isError ? <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} /> : <Field className="max-w-md" id="production-campaign" label="Đợt">{(control) => <NativeSelect {...control} value={campaignId} onChange={(e) => setChosen(e.target.value)}>{campaigns.data.length === 0 && <option value="">Chưa có đợt nào</option>}{campaigns.data.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name.includes(campaign.school_year) ? campaign.name : `${campaign.name} · ${campaign.school_year}`}</option>)}</NativeSelect>}</Field>}
    {campaignId ? <CampaignProduction key={campaignId} campaignId={campaignId} /> : !campaigns.isPending && !campaigns.isError && <p className="text-sm text-muted-foreground">Chưa có đợt nào để theo dõi tiến độ.</p>}
  </div>
}
