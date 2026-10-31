import { useQuery } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { productionApi, type Progress } from './api'
import { actorLabel, activitySentence, DEMAND_STEPS, reconcileRows, summarizeCampaign, wideCoverage } from './shared'

export function CampaignSummary({ progress }: { progress: Progress }) {
  const { done, total, overdue, current, completedOn } = summarizeCampaign(progress.steps)
  const finished = total > 0 && done === total
  return <section aria-label="Tóm tắt đợt" className={cn('space-y-3 rounded-md border p-4', finished ? 'border-success/30 bg-success-soft' : 'border-hairline bg-card')}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      {finished
        ? <p className="flex items-center gap-2 font-semibold text-success-ink"><CircleCheck aria-hidden="true" className="size-5" />Đợt đã hoàn tất{completedOn && <span className="font-normal"> · {completedOn}</span>}</p>
        : <p className="font-semibold">Đã xong {done}/{total} bước</p>}
      {overdue > 0 && <p className="flex items-center gap-1.5 text-sm font-medium text-danger-ink"><TriangleAlert aria-hidden="true" className="size-4" />{overdue} bước quá hạn</p>}
    </div>
    <div role="progressbar" aria-label="Tiến độ đợt" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className={cn('h-full rounded-full', finished ? 'bg-success' : 'bg-primary')} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
    {current && <p className="text-sm text-muted-foreground">Đang ở bước {current.position}: {current.name}</p>}
  </section>
}

const stageHeads = ['Sản xuất', 'Kiểm tra chất lượng', 'Đóng gói', 'Giao hàng']

export function Reconciliation({ progress }: { progress: Progress }) {
  const rows = reconcileRows(progress.demand, progress.steps)
  const wide = wideCoverage(progress.steps)
  const hasWide = wide.some((cell) => cell.assigned > 0)
  if (!rows.length && !hasWide) return <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào để đối soát số lượng.</p>
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Mỗi ô: hoàn thành / phân công.</p>
    <div className="max-w-4xl overflow-x-auto rounded-md border border-hairline px-2 py-1">
      <Table className="min-w-[44rem] table-fixed">
        <colgroup><col /><col className="w-20" /><col className="w-28" /><col className="w-28" /><col className="w-28" /><col className="w-28" /></colgroup>
        <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent"><TableHead className="px-3 font-semibold">Sản phẩm</TableHead><TableHead className="px-3 text-right font-semibold">Đã đặt</TableHead>{stageHeads.map((h, i) => <TableHead key={h} className="px-3 text-right font-semibold whitespace-normal">{h}<span className="sr-only"> (bước {DEMAND_STEPS[i]})</span></TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.product_id}>
          <TableCell className="px-3 py-2.5 font-medium whitespace-normal">{row.product_name}</TableCell>
          <TableCell className="px-3 py-2.5 text-right tabular-nums">{row.ordered}</TableCell>
          {row.cells.map((cell, i) => <TableCell key={DEMAND_STEPS[i]} data-tone={cell.tone} className={cn('px-3 py-2.5 text-right tabular-nums',
            cell.tone === 'over' && 'bg-danger-soft font-medium text-danger-ink',
            cell.tone === 'short' && 'bg-warning-soft font-medium text-warning-ink',
            cell.tone === 'none' && cell.assigned > 0 && (cell.completed === cell.assigned ? 'bg-success-soft font-medium text-success-ink' : 'font-medium text-info-ink'))}>
            {cell.completed} / {cell.assigned}{cell.tone === 'over' && <span className="ml-1.5 text-xs">Vượt</span>}{cell.tone === 'short' && <span className="ml-1.5 text-xs">Thiếu</span>}
          </TableCell>)}
        </TableRow>)}
        {hasWide && <TableRow>
          <TableCell className="px-3 py-2.5 font-medium whitespace-normal">Cả đợt <span className="text-xs font-normal text-muted-foreground">(không theo sản phẩm)</span></TableCell>
          <TableCell className="px-3 py-2.5 text-right text-muted-foreground">—</TableCell>
          {wide.map((cell, i) => <TableCell key={DEMAND_STEPS[i]} className="px-3 py-2.5 text-right tabular-nums whitespace-normal">{cell.assigned ? `${cell.completed} / ${cell.assigned} phân công` : '—'}</TableCell>)}
        </TableRow>}</TableBody>
      </Table>
    </div>
  </div>
}

export function ActivityFeed({ campaignId }: { campaignId: string }) {
  const activity = useQuery({ queryKey: ['production', 'activity', campaignId], queryFn: ({ signal }) => productionApi.activity(campaignId, 50, signal), refetchInterval: 60_000 })
  if (activity.isPending) return <LoadingRows rows={4} />
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
  if (!activity.data.length) return <EmptyState title="Chưa có hoạt động" description="Các thay đổi phân công và cập nhật tiến độ của đợt sẽ hiển thị tại đây." />
  return <ol className="space-y-2">{activity.data.map((e) => <li key={e.id} className="space-y-0.5 rounded-md bg-muted/50 p-3 text-sm">
    <p className="text-xs text-muted-foreground">{formatDateTime(e.at)} · {actorLabel(e.actor)}</p>
    <p className="font-medium">{activitySentence(e)}</p>
    {e.action === 'update_progress' && e.note && <p className="text-muted-foreground">{e.note}</p>}
  </li>)}</ol>
}
