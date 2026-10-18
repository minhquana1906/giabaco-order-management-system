import { Check, Equal, Expand, Shrink, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { FIT_LABEL, FIT_VALUES, type Fit } from '@/lib/fit'
import { cn } from '@/lib/utils'

const ICON: Record<Fit, LucideIcon> = {
  TOO_TIGHT: Shrink,
  FITS: Equal,
  TOO_LOOSE: Expand,
}

interface FitChoiceProps {
  value: Fit | null
  onChange: (value: Fit) => void
  name?: string
  disabled?: boolean
  invalid?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

export function FitChoice({
  value,
  onChange,
  name,
  disabled,
  invalid,
  className,
  ...aria
}: FitChoiceProps) {
  const generated = useId()
  const group = name ?? generated
  return (
    <div
      role="radiogroup"
      aria-invalid={invalid || undefined}
      className={cn('grid grid-cols-3 gap-2', className)}
      {...aria}
    >
      {FIT_VALUES.map((fit) => {
        const Icon = ICON[fit]
        const selected = value === fit
        return (
          <label
            key={fit}
            className={cn(
              'relative flex min-h-12 cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-3 text-[15px] transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              selected
                ? 'border-2 border-primary bg-primary font-semibold text-primary-foreground'
                : 'border-input bg-card font-normal hover:bg-accent',
              invalid && !selected && 'border-destructive',
              disabled && 'cursor-not-allowed opacity-50 hover:bg-card',
            )}
          >
            <input
              type="radio"
              name={group}
              value={fit}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(fit)}
              className="sr-only"
            />
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span>{FIT_LABEL[fit]}</span>
            {selected ? (
              <Check
                className="absolute right-1.5 top-1.5 size-3.5 text-brass"
                strokeWidth={3}
                aria-hidden="true"
              />
            ) : null}
          </label>
        )
      })}
    </div>
  )
}
