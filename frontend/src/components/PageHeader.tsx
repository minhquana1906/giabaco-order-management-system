import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-x-5 gap-y-2', className)}>
      <h1 className="text-[22px] font-semibold leading-tight sm:text-[26px]">{title}</h1>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
