import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

interface FieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  children: (control: ControlProps) => ReactNode
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint ? (
        <p id={`${id}-hint`} className="text-[15px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[15px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
