import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { SizeLabel } from '@/components/SizeLabel'
import { UnknownHatchPattern } from '@/components/UnknownHatchPattern'
import { Card } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/format'
import { readableOn, sizeColor, UNKNOWN_PATTERN_FILL, UNKNOWN_SIZE_LABEL } from '@/lib/sizes'
import { useClassMatrix } from '../hooks'
import { SizeLegend } from './SizeLegend'
import { ViewSwitch } from './ViewSwitch'

type View = 'table' | 'chart'

const VIEWS = [
  { value: 'table', label: 'Bảng' },
  { value: 'chart', label: 'Biểu đồ' },
] as const

const NAVY = [0x1b, 0x2b, 0x4b] as const

function heat(value: number, max: number) {
  const t = max > 0 ? (value / max) * 0.72 : 0
  const bg = `#${NAVY.map((c) => Math.round(255 + (c - 255) * (value === 0 ? 0.04 : 0.1 + t)).toString(16).padStart(2, '0')).join('')}`
  return { backgroundColor: bg, color: readableOn(bg) }
}

const cellLink =
  'block min-h-11 rounded-[2px] px-2 py-2.5 text-center font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:brightness-95 sm:min-h-0 sm:py-1.5'

interface MatrixTooltipPayloadEntry {
  dataKey?: string | number
  value?: number
  payload: {
    name?: string
    class_name?: string
    total?: number
  }
}

function ClassMatrixTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: MatrixTooltipPayloadEntry[]
}) {
  if (!active || !payload?.length) return null
  const first = payload[0]
  if (!first) return null
  const row = first.payload
  const rawName = row.class_name ?? row.name ?? ''
  const className = rawName ? (rawName.startsWith('Lớp') ? rawName : `Lớp ${rawName}`) : ''
  const total = Number(row.total ?? 0)

  if (payload.length === 1) {
    const rawKey = String(first.dataKey ?? '')
    const size = rawKey === 'unknown' ? 'Chưa xác định' : rawKey.startsWith('s') ? `Cỡ ${rawKey.slice(1)}` : rawKey
    const count = Number(first.value ?? 0)
    const share = total > 0 ? (count / total) * 100 : 0
    return (
      <div className="rounded-md border border-hairline bg-popover px-3 py-1.5 text-xs shadow-md">
        <span className="font-semibold">{className} · {size}</span>
        <span className="text-muted-foreground">: </span>
        <span className="font-medium tabular-nums">
          {formatNumber(count)} HS ({formatPercent(share)})
        </span>
      </div>
    )
  }

  const nonZero = payload.filter((entry) => Number(entry.value ?? 0) > 0)
  return (
    <div className="flex flex-col gap-1 rounded-md border border-hairline bg-popover px-3 py-2 text-xs shadow-md">
      <span className="font-semibold">{className}</span>
      {nonZero.map((entry) => {
        const rawKey = String(entry.dataKey ?? '')
        const size = rawKey === 'unknown' ? 'Chưa xác định' : rawKey.startsWith('s') ? `Cỡ ${rawKey.slice(1)}` : rawKey
        const count = Number(entry.value ?? 0)
        const share = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={rawKey} className="flex items-center justify-between gap-3 tabular-nums">
            <span className="text-muted-foreground">{size}:</span>
            <span className="font-medium">{formatNumber(count)} HS ({formatPercent(share)})</span>
          </div>
        )
      })}
    </div>
  )
}

export function ClassMatrixCard({
  product,
  productName,
  schoolId,
}: {
  product: string
  productName: string
  schoolId: string | undefined
}) {
  const [view, setView] = useState<View>('table')
  const query = useClassMatrix(product, schoolId)

  const studentsSearch = (extra: { class_id?: string; size?: string }) =>
    ({ school_id: schoolId, product, ...extra }) as never

  const matrix = query.data
  const max = matrix
    ? Math.max(0, ...matrix.rows.flatMap((r) => [r.unknown, ...matrix.sizes.map((s) => r.counts[s] ?? 0)]))
    : 0

  const chartData = matrix?.rows.map((r) => ({
    name: r.class_name,
    class_name: r.class_name,
    total: r.total,
    ...Object.fromEntries(matrix.sizes.map((s) => [`s${s}`, r.counts[s] ?? 0])),
    unknown: r.unknown,
  }))

  return (
    <Card className="min-w-0 gap-3">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Lớp × cỡ · {productName}</h2>
          <p className="text-xs text-muted-foreground">Số học sinh theo cỡ vừa suy ra</p>
        </div>
        <ViewSwitch value={view} onChange={setView} options={VIEWS} label="Kiểu hiển thị lớp theo cỡ" />
      </div>
      <div className="px-5">
        {!schoolId ? (
          <EmptyState title="Chưa có trường" description="Thêm trường và lớp khi thêm học sinh đầu tiên." />
        ) : query.isPending ? (
          <Skeleton className="h-[220px] w-full" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.rows.length === 0 ? (
          <EmptyState title="Trường này chưa có lớp" description="Lớp được tạo khi thêm học sinh." />
        ) : view === 'table' ? (
          <div className="-mx-5 overflow-x-auto px-5 max-md:[mask-image:linear-gradient(to_right,#000_85%,transparent)] max-md:scroll-pr-8">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 bg-card py-1.5 pr-3 text-left font-normal text-muted-foreground">
                    Lớp
                  </th>
                  {query.data.sizes.map((s) => (
                    <th key={s} scope="col" className="px-0.5 py-1.5 text-center">
                      <SizeLabel label={s} />
                    </th>
                  ))}
                  <th scope="col" className="px-0.5 py-1.5 text-center text-xs font-normal text-muted-foreground">
                    {UNKNOWN_SIZE_LABEL}
                  </th>
                  <th scope="col" className="py-1.5 pl-3 text-right font-semibold">
                    Tổng
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((r) => (
                  <tr key={r.class_id}>
                    <th scope="row" className="sticky left-0 bg-card py-0.5 pr-3 text-left font-semibold">
                      <Link
                        to="/students"
                        search={studentsSearch({ class_id: r.class_id })}
                        className="inline-flex min-h-11 items-center rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                      >
                        {r.class_name}
                      </Link>
                    </th>
                    {query.data.sizes.map((s) => (
                      <Cell
                        key={s}
                        value={r.counts[s] ?? 0}
                        max={max}
                        search={studentsSearch({ class_id: r.class_id, size: s })}
                        label={`${r.class_name}, cỡ ${s}`}
                      />
                    ))}
                    <Cell
                      value={r.unknown}
                      max={max}
                      search={studentsSearch({ class_id: r.class_id, size: 'none' })}
                      label={`${r.class_name}, chưa xác định`}
                    />
                    <td className="py-0.5 pl-3 text-right font-semibold tabular-nums">{formatNumber(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <th scope="row" className="sticky left-0 bg-card py-2 pr-3 text-left">
                    Tổng
                  </th>
                  {query.data.sizes.map((s) => (
                    <td key={s} className="py-2 text-center tabular-nums">
                      {formatNumber(query.data.totals.counts[s] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 text-center tabular-nums">{formatNumber(query.data.totals.unknown)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{formatNumber(query.data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto max-md:[mask-image:linear-gradient(to_right,#000_85%,transparent)]">
              <ChartContainer
                config={{}}
                className="aspect-auto min-w-[420px]"
                style={{ height: Math.max(180, query.data.rows.length * 40 + 40) }}
                role="img"
                aria-label={`Số học sinh theo lớp và cỡ, ${productName}`}
              >
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <UnknownHatchPattern />
                  <Tooltip content={<ClassMatrixTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} isAnimationActive={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={{ stroke: '#e3e6ec' }} />
                  <YAxis type="category" dataKey="name" width={48} tickLine={false} axisLine={false} className="font-semibold" />
                  {query.data.sizes.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={`s${s}`}
                      stackId="a"
                      fill={sizeColor(i, query.data.sizes.length)}
                      isAnimationActive={false}
                    />
                  ))}
                  <Bar dataKey="unknown" stackId="a" fill={UNKNOWN_PATTERN_FILL} stroke="#a9b2c3" isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            </div>
            <SizeLegend items={[...query.data.sizes.map((label) => ({ label })), { label: null }]} />
          </div>
        )}
      </div>
    </Card>
  )
}

function Cell({ value, max, search, label }: { value: number; max: number; search: never; label: string }) {
  return (
    <td className="p-0.5">
      {value > 0 ? (
        <Link to="/students" search={search} aria-label={`${label}: ${value} học sinh`} className={cellLink} style={heat(value, max)}>
          {formatNumber(value)}
        </Link>
      ) : (
        <span className={`${cellLink} text-muted-foreground`} style={heat(0, max)} aria-label={`${label}: 0 học sinh`}>
          0
        </span>
      )}
    </td>
  )
}
