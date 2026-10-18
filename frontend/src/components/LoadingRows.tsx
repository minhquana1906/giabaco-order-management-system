import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingRowsProps {
  rows?: number
  className?: string
}

export function LoadingRows({ rows = 5, className }: LoadingRowsProps) {
  return (
    <div role="status" aria-label="Đang tải" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
