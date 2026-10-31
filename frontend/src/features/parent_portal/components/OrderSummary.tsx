import { SizeLabel } from '@/components/SizeLabel'
import type { Ordering, OrderLines, TailorLine } from '../api'
import { formatPrice, reviewRows } from '../choices'
import { ColourChip } from './ColourSelect'
import { ZoomableImage } from './ZoomableImage'

interface OrderSummaryProps {
  ordering: Pick<Ordering, 'kits' | 'items'>
  lines: OrderLines
  total: number
  hasUnpriced: boolean
}

function TailorSummary({ line }: { line?: TailorLine }) {
  if (!line) return null
  return (
    <div className="text-sm text-muted-foreground">
      {line.is_tailor ? line.tailor_measurements?.map((field) => {
        const value = line.measurements?.[field.key] ?? field.value
        return value != null ? <p key={field.key}>{field.label}: {value} cm</p> : null
      }) : null}
      {line.note ? <p>Ghi chú: {line.note}</p> : null}
    </div>
  )
}

export function OrderSummary({ ordering, lines, total, hasUnpriced }: OrderSummaryProps) {
  const rows = reviewRows(ordering, lines)
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid items-start gap-4 md:grid-cols-2 lg:gap-6">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 rounded-lg border border-hairline bg-white p-4"
          >
            <ZoomableImage image={row.image} alt={row.name} eager={index < 2} />
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="text-base font-semibold leading-6 text-navy">{row.name}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <SizeLabel label={row.size} scale="lg" />
                <ColourChip colour={row.colour} className="text-[15px]" />
                <span className="tabular-nums text-[15px] text-muted-foreground">× {row.qty}</span>
              </div>
              <TailorSummary line={row.tailor} />
              {row.parts.length > 0 ? (
                <ul className="flex flex-col gap-1 text-[15px] text-muted-foreground">
                  {row.parts.map((part) => (
                    <li key={part.label} className="flex flex-wrap items-center gap-x-2">
                      <span>
                        {part.label}: {part.name}
                      </span>
                      <SizeLabel label={part.size} scale="sm" />
                      <ColourChip colour={part.colour} className="text-sm" />
                      <div className="w-full"><TailorSummary line={part.tailor} /></div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="mt-auto flex items-baseline justify-between gap-3 border-t border-hairline pt-2 text-[15px]">
                <div>
                  <dt className="sr-only">Thành tiền</dt>
                  <dd className="font-semibold tabular-nums text-navy">{row.amount == null ? '—' : formatPrice(row.amount)}</dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-secondary p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium text-navy">Tạm tính, chưa thanh toán</p>
          <p className="whitespace-nowrap text-xl font-semibold tabular-nums text-navy">{total === 0 && hasUnpriced ? '—' : formatPrice(total)}</p>
        </div>
        {hasUnpriced ? <p className="text-[15px] text-muted-foreground">Một số sản phẩm chưa có giá</p> : null}
      </div>
    </div>
  )
}
