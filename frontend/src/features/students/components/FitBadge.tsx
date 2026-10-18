import { Equal, Expand, Shrink, type LucideIcon } from 'lucide-react'
import { FIT_LABEL, type Fit } from '@/lib/fit'

const ICON: Record<Fit, LucideIcon> = { TOO_TIGHT: Shrink, FITS: Equal, TOO_LOOSE: Expand }

export function FitBadge({ fit }: { fit: Fit }) {
  const Icon = ICON[fit]
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${fit === 'FITS' ? 'font-semibold' : ''}`}>
      <Icon className="size-4" aria-hidden="true" />
      {FIT_LABEL[fit]}
    </span>
  )
}
