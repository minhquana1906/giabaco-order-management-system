import type { ReactNode } from 'react'

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-hairline bg-card p-3 sm:p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
