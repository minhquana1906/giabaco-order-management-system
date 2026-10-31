import { useState } from 'react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, Tooltip, XAxis } from 'recharts'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ApiError } from '@/lib/http'
import { SizeLabel } from '@/components/SizeLabel'
import { Skeleton } from '@/components/ui/skeleton'
import { UnknownHatchPattern } from '@/components/UnknownHatchPattern'
import { Card } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import { formatNumber, formatPercent } from '@/lib/format'
import { sizeColor, UNKNOWN_HATCH_CLASS, UNKNOWN_PATTERN_FILL } from '@/lib/sizes'
import { cn } from '@/lib/utils'
import { useSizeDistribution } from '../hooks'
import { SizeLegend } from './SizeLegend'
import { ViewSwitch } from './ViewSwitch'

type View = 'bar' | 'pie'

const VIEWS = [
  { value: 'bar', label: 'Cột' },
  { value: 'pie', label: 'Tròn' },
] as const

interface Datum {
  key: string
  label: string | null
  count: number
  percent: number
  fill: string
}

interface TickProps {
  x?: number | string
  y?: number | string
  index?: number
}
function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: Datum }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const label = d.label !== null ? `Cỡ ${d.label}` : 'Chưa xác định'
  return (
    <div className="rounded-md border border-hairline bg-popover px-3 py-1.5 text-xs">
      <span className="font-semibold">{label}</span>
      <span className="text-muted-foreground">: </span>
      <span className="font-medium tabular-nums">
        {formatNumber(d.count)} học sinh ({formatPercent(d.percent)})
      </span>
    </div>
  )
}


export function DistributionCard({
  product,
  productName,
  schoolId,
}: {
  product: string
  productName: string
  schoolId: string | undefined
}) {
  const [view, setView] = useState<View>('bar')
  const query = useSizeDistribution(product, schoolId)

  const sizes = query.data?.sizes ?? []
  const known = sizes.filter((s) => s.size_label !== null).length
  let knownIndex = 0
  const data: Datum[] = sizes.map(({ size_label, count, percent }) => ({
    key: size_label ?? 'none',
    label: size_label,
    count,
    percent,
    fill: size_label === null ? UNKNOWN_PATTERN_FILL : sizeColor(knownIndex++, known),
  }))

  const renderTick = ({ x = 0, y = 0, index = 0 }: TickProps) => {
    const d = data[index]
    if (!d) return <g />
    return (
      <foreignObject x={Number(x) - 34} y={Number(y) + 4} width={68} height={60}>
        <div className="flex flex-col items-center gap-0.5 tabular-nums">
          {d.label === null ? (
            <span
              className={cn(
                UNKNOWN_HATCH_CLASS,
                'inline-flex flex-col items-center justify-center rounded-[2px] border border-[#a9b2c3] px-1 py-0.5 text-[11px] font-medium leading-none text-[#16203a]',
              )}
            >
              <span className="rounded-[1px] bg-[#eef0f4] px-0.5 pb-0.5">Chưa</span>
              <span className="rounded-[1px] bg-[#eef0f4] px-0.5">xác định</span>
            </span>
          ) : (
            <SizeLabel label={d.label} />
          )}
          <span className="text-[11px] text-muted-foreground">{formatPercent(d.percent)}</span>
        </div>
      </foreignObject>
    )
  }

  return (
    <Card className="min-w-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Phân bố cỡ · toàn trường · {productName}</h2>
          <p className="text-xs text-muted-foreground">
            Cỡ hiển thị là cỡ vừa suy ra.
          </p>
        </div>
        <ViewSwitch value={view} onChange={setView} options={VIEWS} label="Kiểu biểu đồ phân bố" />
      </div>
      <div className="px-5">
        {query.isPending ? (
          <Skeleton className="h-[260px] w-full" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            message={query.error instanceof ApiError ? undefined : 'Chưa tải được thống kê phân bố. Bấm Thử lại hoặc quay lại sau ít phút.'}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.total === 0 ? (
          <EmptyState
            title="Chưa có học sinh nào"
            description="Biểu đồ sẽ hiện khi có học sinh được thêm vào trường này."
          />
        ) : view === 'bar' ? (
          <div role="region" aria-label={`Biểu đồ phân bố cỡ ${productName}`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring">
            <ChartContainer
              config={{ count: { label: 'Học sinh' } }}
              className="aspect-auto h-[270px] w-full"
              style={{ minWidth: data.length * 68 + 40 }}
              role="img"
              aria-label={`Phân bố cỡ ${productName}: ${data
                .map((d) => `${d.label === null ? 'chưa xác định' : `cỡ ${d.label}`} ${d.count}`)
                .join(', ')}`}
            >
              <BarChart data={data} margin={{ top: 22, right: 20, left: 20, bottom: 0 }}>
                <UnknownHatchPattern />
                <Tooltip content={<DistributionTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} isAnimationActive={false} />
                <XAxis dataKey="key" tickLine={false} axisLine={{ stroke: '#e3e6ec' }} height={64} tick={renderTick} interval={0} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={80} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.label ?? 'none'} fill={d.fill} stroke={d.label === null ? '#a9b2c3' : undefined} />
                  ))}
                  <LabelList dataKey="count" position="top" className="fill-foreground text-xs font-semibold" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-10">
            <div className="relative size-[230px] shrink-0">
              <ChartContainer
                config={{ count: { label: 'Học sinh' } }}
                className="aspect-square size-full"
                role="img"
                aria-label={`Phân bố cỡ ${productName} dạng tròn`}
              >
                <PieChart>
                  <UnknownHatchPattern />
                  <Tooltip content={<DistributionTooltip />} isAnimationActive={false} />
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={68}
                    outerRadius={108}
                    paddingAngle={1}
                    stroke="#ffffff"
                    isAnimationActive={false}
                  >
                    {data.map((d) => (
                      <Cell key={d.label ?? 'none'} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center tabular-nums">
                <span className="text-[28px] font-semibold leading-none">{formatNumber(query.data.total)}</span>
                <span className="text-xs text-muted-foreground">học sinh</span>
              </div>
            </div>
            <SizeLegend items={data.map(({ label, count, percent }) => ({ label, count, percent }))} />
          </div>
        )}
      </div>
    </Card>
  )
}
