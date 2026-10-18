import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface StatBlockProps {
  label: ReactNode
  value: number | string
  sub?: ReactNode
  className?: string
}

export function StatBlock({ label, value, sub, className }: StatBlockProps) {
  return (
    <div className={cn('rounded-lg border bg-card px-5 py-3', className)}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[30px] font-semibold leading-[1.1]">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
