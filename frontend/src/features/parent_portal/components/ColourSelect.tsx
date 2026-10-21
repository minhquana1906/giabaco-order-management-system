import type { Colour } from '../api'
import { cn } from '@/lib/utils'

interface ColourSelectProps {
  name: string
  colours: Colour[]
  labelledBy: string
  value: string | null
  invalid?: boolean
  onChange: (next: string) => void
}

export function ColourChip({ colour, className }: { colour: Colour | null; className?: string }) {
  if (!colour) return null
  return (
    <span className={cn('inline-flex items-center gap-2 font-medium text-navy', className)}>
      <span
        aria-hidden="true"
        className="size-4 rounded-full ring-1 ring-inset ring-black/20"
        style={{ backgroundColor: colour.hex }}
      />
      {colour.label}
    </span>
  )
}

export function ColourSelect({ name, colours, labelledBy, value, invalid = false, onChange }: ColourSelectProps) {
  if (colours.length < 2) return null
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-required="true"
      aria-invalid={invalid || undefined}
      className="grid grid-cols-2 gap-2"
    >
      {colours.map((c) => {
        const on = value === c.code
        return (
          <label
            key={c.code}
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
              name={name}
              value={c.code}
              checked={on}
              onChange={() => onChange(c.code)}
            />
            <span
              aria-hidden="true"
              className={cn('size-5 rounded-full ring-1 ring-inset', on ? 'ring-white/60' : 'ring-black/20')}
              style={{ backgroundColor: c.hex }}
            />
            {c.label}
          </label>
        )
      })}
    </div>
  )
}
