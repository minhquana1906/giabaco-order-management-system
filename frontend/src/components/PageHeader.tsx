import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5', className)}>
      <h1 className="min-w-0 break-words text-[22px] font-semibold leading-tight sm:text-[26px]">{title}</h1>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">{actions}</div> : null}
    </header>
  )
}
