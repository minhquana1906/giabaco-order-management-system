import { NativeSelect } from '@/components/NativeSelect'
import type { DobParts } from '@/lib/dob'
import { cn } from '@/lib/utils'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 31 }, (_, i) => new Date().getFullYear() - i)

interface DobSelectsProps {
  value: DobParts
  onChange: (next: DobParts) => void
  error?: string
  legendClassName?: string
  selectClassName?: string
}

export function DobSelects({ value, onChange, error, legendClassName, selectClassName }: DobSelectsProps) {
  const field = (key: keyof DobParts, label: string, options: number[]) => (
    <NativeSelect
      aria-label={label}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? 'dob-error' : undefined}
      className={selectClassName}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value })}
    >
      <option value="">{label}</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </NativeSelect>
  )
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className={cn('mb-1.5 text-sm font-medium', legendClassName)}>Ngày sinh</legend>
      <div className="grid grid-cols-3 gap-2">
        {field('day', 'Ngày', DAYS)}
        {field('month', 'Tháng', MONTHS)}
        {field('year', 'Năm', YEARS)}
      </div>
      {error ? (
        <p id="dob-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
