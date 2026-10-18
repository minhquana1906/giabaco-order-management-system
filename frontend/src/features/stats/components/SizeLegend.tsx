import { SizeLabel } from '@/components/SizeLabel'
import { formatNumber, formatPercent } from '@/lib/format'

export interface LegendItem {
  label: string | null
  count?: number
  percent?: number
}

export function SizeLegend({ items }: { items: LegendItem[] }) {
  const hasStats = items.some((item) => item.count !== undefined)

  if (!hasStats) {
    return (
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => (
          <li key={item.label ?? 'none'} className="flex items-center gap-2 text-[13px] tabular-nums">
            <SizeLabel label={item.label} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="flex w-full max-w-[250px] flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.label ?? 'none'} className="flex items-center justify-between gap-3 text-[13px] tabular-nums">
          <SizeLabel label={item.label} />
          {item.count !== undefined ? (
            <div className="flex items-center gap-1.5">
              <span className="w-8 text-right font-semibold">{formatNumber(item.count)}</span>
              {item.percent !== undefined ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="w-12 text-right text-muted-foreground">{formatPercent(item.percent)}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
