import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function UnitInput({ unit, className, ...props }: ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input inputMode="decimal" autoComplete="off" className={cn('min-w-0 flex-1', className)} {...props} />
      <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}
