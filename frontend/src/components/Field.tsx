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
  error?: string
  children: (control: ControlProps) => ReactNode
}

export function Field({ id, label, error, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[15px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
