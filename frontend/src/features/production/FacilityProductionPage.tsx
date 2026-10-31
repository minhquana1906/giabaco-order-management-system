import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { cn } from '@/lib/utils'
import { productionApi, type Assignment } from './api'
import { FacilityStepCard, stepStatus, type FacilityStep } from './FacilityStepCard'
import { productionKeys, touch } from './shared'

export function FacilityLoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const client = useQueryClient()
  const login = useMutation({ mutationFn: productionApi.login, onSuccess: () => { client.removeQueries({ queryKey: productionKeys.all }); onSuccess() } })
  const submit = (e: FormEvent) => { e.preventDefault(); login.mutate({ username: username.trim(), password }) }
  return <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10"><form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg bg-card p-5 sm:p-6">
    <h1 className="text-2xl font-semibold text-navy">Đăng nhập đối tác</h1>
    <Field id="facility-login-username" label="Tên đăng nhập">{(control) => <Input {...control} className={touch} required autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />}</Field>
    <Field id="facility-login-password" label="Mật khẩu">{(control) => <Input {...control} className={touch} required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
    {login.isError && <p role="alert" className="text-sm font-medium text-danger-ink">{login.error instanceof ApiError && login.error.status === 401 ? login.error.message : requestErrorMessage(login.error, 'Chưa đăng nhập được. Vui lòng thử lại sau ít phút.')}</p>}
    <Button className={`w-full ${touch}`} disabled={login.isPending}>{login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
  </form></main>
}

/** Groups the already ordered assignments into campaign, then step. */
function groupAssignments(assignments: Assignment[]) {
  const campaigns: { id: string; name: string; steps: FacilityStep[] }[] = []
  for (const a of assignments) {
    let campaign = campaigns.find((c) => c.id === a.campaign_id)
    if (!campaign) campaigns.push(campaign = { id: a.campaign_id, name: a.campaign_name, steps: [] })
    let step = campaign.steps.find((s) => s.position === a.step_position)
    if (!step) campaign.steps.push(step = { position: a.step_position, name: a.step_name, items: [] })
    step.items.push(a)
  }
  return campaigns
}

function SummaryStrip({ steps }: { steps: FacilityStep[] }) {
  const statuses = steps.map((s) => stepStatus(s.items))
  const count = (status: string) => statuses.filter((s) => s === status).length
  const overdue = steps.filter((s) => s.items.some((a) => a.overdue)).length
  const cells = [
    { label: 'Chưa bắt đầu', value: count('pending'), tone: 'bg-secondary text-secondary-foreground' },
    { label: 'Đang thực hiện', value: count('in_progress'), tone: 'bg-info-soft text-info-ink' },
    { label: 'Hoàn thành', value: count('completed'), tone: 'bg-success-soft text-success-ink' },
    { label: 'Quá hạn', value: overdue, tone: overdue > 0 ? 'bg-danger-soft text-danger-ink' : 'bg-secondary text-secondary-foreground' },
  ]
  return <dl aria-label="Tóm tắt các bước" className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
    {cells.map((cell) => <div key={cell.label} className={cn('flex min-w-0 items-baseline gap-2.5 rounded-md px-3 py-2.5 sm:px-4', cell.tone)}>
      <dd className="order-first text-xl leading-none font-semibold tabular-nums">{cell.value}</dd>
      <dt className="text-[13px] font-medium">{cell.label}</dt>
    </div>)}
  </dl>
}

function FacilityAssignments({ assignments, page, onPage }: { assignments: Assignment[]; page: number; onPage: (page: number) => void }) {
  const [chosen, setChosen] = useState('')
  const hasMore = assignments.length >= 100
  const campaigns = groupAssignments(assignments)
  const campaign = campaigns.find((c) => c.id === chosen) ?? campaigns[0]
  if (!campaign) return page === 0 ? <EmptyState title="Chưa có công việc nào được giao." /> : <Button variant="outline" className={touch} onClick={() => onPage(page - 1)}>Trang trước</Button>
  return <>
    {campaigns.length > 1
      ? <Field className="sm:max-w-sm" id="facility-campaign" label="Đợt">{(control) => <NativeSelect {...control} value={campaign.id} onChange={(e) => setChosen(e.target.value)}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>}</Field>
      : <h2 className="text-lg font-semibold text-navy">{campaign.name}</h2>}
    <SummaryStrip steps={campaign.steps} />
    <div className="space-y-4">{campaign.steps.map((step) => <FacilityStepCard key={step.position} step={step} />)}</div>
    {(page > 0 || hasMore) && <nav aria-label="Phân trang" className="flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" className="h-11 md:h-8" disabled={page === 0} onClick={() => onPage(page - 1)}>Trang trước</Button>
      <span className="min-w-16 text-center tabular-nums">Trang {page + 1}</span>
      <Button variant="outline" size="sm" className="h-11 md:h-8" disabled={!hasMore} onClick={() => onPage(page + 1)}>Trang sau</Button>
    </nav>}
  </>
}

function FacilityWorkspace({ onLogout }: { onLogout: () => void }) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const assignments = useQuery({ queryKey: ['production', 'assignments', page], queryFn: ({ signal }) => productionApi.assignments({ limit: 100, offset: page * 100 }, signal), refetchInterval: 60_000 })
  const logout = useMutation({ mutationFn: productionApi.logout, onSuccess: () => { client.removeQueries({ queryKey: productionKeys.all }); onLogout() } })
  const facilityName = assignments.data?.find((a) => a.facility_name)?.facility_name
  return <div className="min-h-dvh bg-background">
    <header className="on-navy border-b border-piping bg-navy">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
        <p className="text-lg leading-none font-bold tracking-[0.5px] text-white">G<span className="text-brass">-</span>UNIFORM</p>
        <Button variant="ghost" className={`text-white hover:bg-white/10 hover:text-white ${touch}`} disabled={logout.isPending} onClick={() => logout.mutate()}>Đăng xuất</Button>
      </div>
    </header>
    <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[22px] leading-tight font-semibold text-navy break-words sm:text-[26px]">{facilityName ?? 'Công việc được giao'}</h1>
        {facilityName && <p className="text-sm text-muted-foreground">Công việc được giao</p>}
      </div>
      {logout.isError && <p role="alert" className="font-medium text-danger-ink">Chưa đăng xuất được. Vui lòng thử lại sau ít phút.</p>}
      {assignments.isPending ? <LoadingRows rows={3} /> : assignments.isError ? <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} /> : <FacilityAssignments assignments={assignments.data} page={page} onPage={setPage} />}
    </main>
  </div>
}

export function FacilityProductionPage({ onLogout }: { onLogout: () => void }) {
  const me = useQuery({ queryKey: productionKeys.me(), queryFn: ({ signal }) => productionApi.me(signal), retry: false })
  if (me.isPending) return <main className="p-4">Đang tải phiên đăng nhập…</main>
  if (me.isError) return <main className="p-4"><ErrorState error={me.error} onRetry={() => void me.refetch()} /></main>
  if (me.data.role !== 'facility') return <main className="p-4">Tài khoản này không phải tài khoản đối tác. Đăng nhập bằng tài khoản đối tác.</main>
  return <FacilityWorkspace onLogout={onLogout} />
}
