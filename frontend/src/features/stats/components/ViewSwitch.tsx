import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ViewSwitchProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  label: string
}

export function ViewSwitch<T extends string>({ value, onChange, options, label }: ViewSwitchProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      className="shrink-0"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-9 min-h-9 px-3.5 text-foreground/80 data-[state=on]:bg-muted data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_-3px_0_0_var(--brass)] max-sm:h-11"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
