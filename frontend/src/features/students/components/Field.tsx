import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  htmlFor?: string
  error?: string
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
