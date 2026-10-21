import { SizeLabel } from '@/components/SizeLabel'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import type { PivotGroup, PivotMeasure } from '../api'
import { formatCell, heatStyle, type Matrix, type MatrixCell } from '../pivotLogic'

const ROW_LABEL: Record<PivotGroup, string> = { product: 'Sản phẩm', kit: 'Bộ', class: 'Lớp' }
const MEASURE_LABEL: Record<PivotMeasure, string> = { qty: 'số lượng (cái)', orders: 'số học sinh đặt', amount: 'thành tiền (đồng)' }

const cellBase = 'min-w-[64px] px-1 py-0.5 text-center tabular-nums'
const stickyHead = 'sticky left-0 z-10 bg-card'

function BodyCell({ cell, max }: { cell: MatrixCell; max: number }) {
  const style = cell.unpriced ? undefined : heatStyle(cell.value, max)
  return (
    <td className={cellBase}>
      <span
        className={cn(
          'flex min-h-11 items-center justify-center rounded-[2px] px-2 font-medium sm:min-h-8',
          !style && 'text-muted-foreground/60',
        )}
        style={style}
      >
        {formatCell(cell)}
      </span>
    </td>
  )
}

interface PivotMatrixProps {
  matrix: Matrix
  group: PivotGroup
  measure: PivotMeasure
  subject: string
}

export function PivotMatrix({ matrix, group, measure, subject }: PivotMatrixProps) {
  return (
    <div className="-mr-5 overflow-x-auto pr-5 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%_-_20px),transparent)]">
      <table className="w-full border-collapse text-[13px]">
        <caption className="pb-2 text-left text-xs text-muted-foreground">
          {`${subject}: ${MEASURE_LABEL[measure]} theo cỡ`}
        </caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className={cn(stickyHead, 'min-w-[132px] py-2 pr-3 text-left text-xs font-normal text-muted-foreground')}>
              {ROW_LABEL[group]}
            </th>
            {matrix.sizes.map((s) => (
              <th key={s} scope="col" className="px-1 py-2 text-center">
                <SizeLabel label={s} />
              </th>
            ))}
            <th scope="col" className="min-w-[72px] py-2 pl-3 text-right font-semibold">
              Tổng
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className={cn(stickyHead, 'py-1 pr-3 text-left font-semibold')}>
                <span className="block">{r.name}</span>
                <span className="block text-xs font-normal tabular-nums text-muted-foreground">
                  {formatNumber(r.orders)} đơn
                </span>
              </th>
              {r.cells.map((c, i) => (
                <BodyCell key={matrix.sizes[i]} cell={c} max={matrix.max} />
              ))}
              <td className="py-1 pl-3 text-right font-semibold tabular-nums">{formatCell(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <th scope="row" className={cn(stickyHead, 'py-2 pr-3 text-left font-semibold')}>
              Tổng
            </th>
            {matrix.footer.cells.map((c, i) => (
              <td key={matrix.sizes[i]} className={cn(cellBase, 'py-2 font-semibold')}>
                {formatCell(c)}
              </td>
            ))}
            <td className="py-2 pl-3 text-right font-semibold tabular-nums">{formatCell(matrix.footer.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
