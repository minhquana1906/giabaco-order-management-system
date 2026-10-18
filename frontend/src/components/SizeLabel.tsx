import { UNKNOWN_HATCH_CLASS, UNKNOWN_SIZE_LABEL } from '@/lib/sizes'
import { cn } from '@/lib/utils'

type SizeLabelScale = 'sm' | 'md' | 'lg'

interface SizeLabelProps {
  label: string | null | undefined
  scale?: SizeLabelScale
  className?: string
}

const SCALE: Record<SizeLabelScale, string> = {
  sm: 'px-[7px] py-[3px] text-xs',
  md: 'px-2.5 py-1 text-[13px]',
  lg: 'px-3.5 py-1.5 text-[15px]',
}

const TRACKING: Record<SizeLabelScale, string> = {
  sm: 'tracking-[0.5px]',
  md: 'tracking-[0.6px]',
  lg: 'tracking-[0.8px]',
}

export function SizeLabel({ label, scale = 'sm', className }: SizeLabelProps) {
  if (label == null) {
    return (
      <span
        className={cn(
          UNKNOWN_HATCH_CLASS,
          'inline-block whitespace-nowrap rounded-[2px] border border-[#a9b2c3] font-medium text-[#16203a]',
          SCALE[scale],
          className,
        )}
      >
        <span className="rounded-[1px] bg-[#eef0f4] px-1">{UNKNOWN_SIZE_LABEL}</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'woven-label inline-block whitespace-nowrap rounded-[2px] font-semibold',
        SCALE[scale],
        TRACKING[scale],
        className,
      )}
    >
      Cỡ {label}
    </span>
  )
}
