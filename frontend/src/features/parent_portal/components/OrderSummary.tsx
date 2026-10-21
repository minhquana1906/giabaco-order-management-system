import { SizeLabel } from '@/components/SizeLabel'
import type { Ordering, OrderLines } from '../api'
import { formatPrice, reviewRows } from '../choices'
import { ColourChip } from './ColourSelect'
import { ZoomableImage } from './ZoomableImage'

interface OrderSummaryProps {
  ordering: Pick<Ordering, 'kits' | 'items'>
  lines: OrderLines
  total: number
  hasUnpriced: boolean
}

export function OrderSummary({ ordering, lines, total, hasUnpriced }: OrderSummaryProps) {
  const rows = reviewRows(ordering, lines)
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 md:grid-cols-2 lg:gap-6">
        {rows.map((row) => (
          <li
            key={row.key}
            className="grid grid-cols-[128px_minmax(0,1fr)] gap-4 rounded-lg border border-hairline bg-white p-4 lg:p-5"
          >
            <ZoomableImage image={row.image} alt={row.name} />
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="text-lg font-semibold text-navy">{row.name}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <SizeLabel label={row.size} scale="lg" />
                <ColourChip colour={row.colour} className="text-[15px]" />
                <span className="tabular-nums text-[15px] text-muted-foreground">× {row.qty}</span>
              </div>
              {row.parts.length > 0 ? (
                <ul className="flex flex-col gap-1 text-[15px] text-muted-foreground">
                  {row.parts.map((part) => (
                    <li key={part.label} className="flex flex-wrap items-center gap-x-2">
                      <span>
                        {part.label}: {part.name}
                      </span>
                      <SizeLabel label={part.size} scale="sm" />
                      <ColourChip colour={part.colour} className="text-sm" />
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="mt-auto flex items-baseline justify-between gap-3 border-t border-hairline pt-2 text-[15px]">
                <div>
                  <dt className="sr-only">Đơn giá</dt>
                  <dd className="tabular-nums text-muted-foreground">{formatPrice(row.unitPrice)}</dd>
                </div>
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
