import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function FormSection({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:p-5', className)}>
      <h2 className="border-b border-hairline pb-3 text-base font-semibold text-navy">{title}</h2>
      {children}
    </section>
  )
}
