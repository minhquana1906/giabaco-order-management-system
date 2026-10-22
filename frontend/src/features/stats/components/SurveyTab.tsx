import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { StatBlock } from '@/components/StatBlock'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { exportsApi, type ExportItem } from '@/features/exports/api'
import { formatNumber, formatPercent } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { useSurveyOverview } from '../hooks'

const SURVEY_EXPORTS: ExportItem[] = [
  { label: 'Tải CSV', path: '/export/surveys.csv', fileName: 'surveys.csv' },
  { label: 'Tải Excel', path: '/export/surveys.xlsx', fileName: 'surveys.xlsx' },
]

const AREA_LABEL: Record<string, string> = { URBAN: 'Thành thị', RURAL: 'Nông thôn' }
const GENDER_LABEL: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ' }
const METHOD_LABEL: Record<string, string> = {
  TAPE_TODAY: 'Vừa đo',
  RECENT_RECORD: 'Số đo gần đây',
  ESTIMATE: 'Ước lượng',
}
const SUPPLY_LABEL: Record<string, string> = { STANDARD: 'Size chuẩn', TAILOR: 'May đo' }

function breakdown(counts: Record<string, number>, labels: Record<string, string>, total: number) {
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${labels[key] ?? key} ${formatNumber(n)} (${formatPercent((n / total) * 100, 0)})`)
  return parts.join(' · ')
}

export function SurveyTab() {
  const overview = useSurveyOverview()
  const download = useMutation({
    mutationFn: (item: ExportItem) => exportsApi.download({ item }),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Không tải được tệp xuất. Thử lại sau.'),
  })

  if (overview.isPending) return <LoadingRows rows={6} />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
  const data = overview.data
  if (data.total_responses === 0) {
    return (
      <EmptyState
        title="Chưa có phiếu khảo sát"
        description="Gửi phụ huynh link /survey trên trang phụ huynh. Phiếu gửi về sẽ hiện ở đây."
      />
    )
  }
  const total = data.total_responses

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Dữ liệu phục vụ clustering và dự trù sản xuất.</p>
        <div className="flex gap-2">
          {SURVEY_EXPORTS.map((item) => (
            <Button
              key={item.path}
              variant="outline"
              className="h-11 md:h-9"
              disabled={download.isPending}
              onClick={() => download.mutate(item)}
            >
              <Download /> {item.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatBlock label="Phiếu đã gửi" value={total} className="max-sm:px-4" />
        <StatBlock
          label="Học sinh (đã loại trùng)"
          value={data.unique_children}
          sub={data.unique_children < total ? `${formatNumber(total - data.unique_children)} phiếu gửi lại` : undefined}
          className="max-sm:px-4"
        />
        <StatBlock
          label="Có đủ 3 vòng đo"
          value={data.with_all_girths}
          sub={`${formatPercent((data.with_all_girths / total) * 100)} tổng số phiếu`}
          className="max-sm:px-4"
        />
        <StatBlock label="Số trường" value={data.schools.length} className="max-sm:px-4" />
      </div>
      <div className="grid gap-3 rounded-lg border bg-card px-5 py-3 text-sm sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Khu vực: </span>
          {breakdown(data.by_area, AREA_LABEL, total)}
        </p>
        <p>
          <span className="text-muted-foreground">Giới tính: </span>
          {breakdown(data.by_gender, GENDER_LABEL, total)}
        </p>
        <p>
          <span className="text-muted-foreground">Cách đo: </span>
          {breakdown(data.by_measure_method, METHOD_LABEL, total)}
        </p>
        <p>
          <span className="text-muted-foreground">Hình thức nhận đồ: </span>
          {breakdown(data.by_supply_option, SUPPLY_LABEL, total)}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trường</TableHead>
              <TableHead>Tỉnh/Thành phố</TableHead>
              <TableHead>Khu vực</TableHead>
              <TableHead className="text-right">Số phiếu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.schools.map((s) => (
              <TableRow key={`${s.school_name}|${s.province}`}>
                <TableCell>{s.school_name}</TableCell>
                <TableCell>{s.province}</TableCell>
                <TableCell>{AREA_LABEL[s.school_area] ?? s.school_area}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(s.responses)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
