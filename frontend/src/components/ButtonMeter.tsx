import { cn } from '@/lib/utils'

interface ButtonMeterProps {
  filled: number
  total?: number
  label: string
  className?: string
}

export function ButtonMeter({ filled, total = 10, label, className }: ButtonMeterProps) {
  const count = Math.max(0, Math.min(total, Math.round(filled)))
  return (
    <div role="img" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'size-6 rounded-full sm:size-[26px]',
            i < count
              ? 'bg-[radial-gradient(circle_at_35%_30%,#e2c47a,#c9a24a_60%,#a07f2e)] shadow-[inset_0_0_0_3px_#c9a24a,inset_0_0_0_4px_#8a6c22]'
              : 'bg-card shadow-[inset_0_0_0_2px_#c5ccda]',
          )}
        />
      ))}
    </div>
  )
}
