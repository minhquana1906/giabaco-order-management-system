import { cn } from '@/lib/utils'

export type GenderValue = 'MALE' | 'FEMALE'

const GENDERS: { value: GenderValue; label: string }[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
]

interface GenderToggleProps {
  value: GenderValue | ''
  onChange: (next: GenderValue) => void
  error?: string
  legendClassName?: string
  optionClassName?: string
}

export function GenderToggle({ value, onChange, error, legendClassName, optionClassName }: GenderToggleProps) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? 'gender-error' : undefined}>
      <legend className={cn('mb-1.5 text-sm font-medium', legendClassName)}>Giới tính</legend>
      <div role="radiogroup" aria-label="Giới tính" className="grid grid-cols-2 rounded-md border border-input p-0.5">
        {GENDERS.map((g) => (
          <label
            key={g.value}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-[5px] px-3 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              optionClassName,
              value === g.value ? 'bg-navy font-semibold text-white' : 'text-foreground hover:bg-accent',
            )}
          >
            <input
              type="radio"
              name="gender"
              value={g.value}
              checked={value === g.value}
              aria-invalid={error ? true : undefined}
              onChange={() => onChange(g.value)}
              className="sr-only"
            />
            {g.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id="gender-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
