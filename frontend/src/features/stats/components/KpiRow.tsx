import { StatBlock } from '@/components/StatBlock'
import { formatNumber, formatPercent } from '@/lib/format'
import type { Overview } from '../api'

export function KpiRow({ overview }: { overview: Overview }) {
  const { total_students: total, students_with_trials: tried, total_trials: trials } = overview
  const perProduct = overview.by_product
    .map((p) => `${p.product_name} ${formatNumber(p.students_tried)} HS thử`)
    .join(' · ')

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatBlock label="Tổng học sinh" value={total} sub={perProduct || undefined} className="max-sm:px-4" />
      <StatBlock
        label="Đã có lần thử"
        value={tried}
        sub={total > 0 ? `${formatPercent((tried / total) * 100)} tổng số HS` : undefined}
        className="max-sm:px-4"
      />
      <StatBlock
        label="Tổng lần thử"
        value={trials}
        sub={tried > 0 ? `TB ${formatNumber(trials / tried, 1)} lần / HS` : undefined}
        className="max-sm:px-4"
      />
      <StatBlock label="Có ghi chú" value={overview.students_with_notes} className="max-sm:px-4" />
    </div>
  )
}
