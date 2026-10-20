import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function FormSection({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-md border border-hairline bg-card p-3 sm:p-4', className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
