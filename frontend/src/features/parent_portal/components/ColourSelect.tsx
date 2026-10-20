import { PRODUCT_COLOURS, colourLabel, type ProductColour } from '@/lib/productColour'
import { cn } from '@/lib/utils'

const SWATCH: Record<ProductColour, string> = { navy: '#1b2b4b', ghi: '#a3a9b3' }

interface ColourSelectProps {
  productCode: string
  labelledBy: string
  value: ProductColour | null
  invalid?: boolean
  onChange: (next: ProductColour) => void
}

export function ColourChip({ colour, className }: { colour: ProductColour | null; className?: string }) {
  const label = colourLabel(colour)
  if (!colour || !label) return null
  return (
    <span className={cn('inline-flex items-center gap-2 font-medium text-navy', className)}>
      <span aria-hidden="true" className="size-4 rounded-full ring-1 ring-inset ring-black/20" style={{ backgroundColor: SWATCH[colour] }} />
      {label}
    </span>
  )
}

export function ColourSelect({ productCode, labelledBy, value, invalid = false, onChange }: ColourSelectProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-required="true"
      aria-invalid={invalid || undefined}
      className="grid grid-cols-2 gap-2"
    >
      {PRODUCT_COLOURS.map((c) => {
        const on = value === c.value
        return (
          <label
            key={c.value}
            className={cn(
              'flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-md border px-3 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              on
                ? 'border-2 border-navy bg-navy font-semibold text-white'
                : cn('bg-card hover:bg-accent', invalid ? 'border-destructive' : 'border-input'),
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={`colour-${productCode}`}
              value={c.value}
              checked={on}
              onChange={() => onChange(c.value)}
            />
            <span
              aria-hidden="true"
              className={cn('size-5 rounded-full ring-1 ring-inset', on ? 'ring-white/60' : 'ring-black/20')}
              style={{ backgroundColor: SWATCH[c.value] }}
            />
            {c.label}
          </label>
        )
      })}
    </div>
  )
}
