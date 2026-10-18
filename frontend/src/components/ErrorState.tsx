import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  error?: unknown
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ error, message, onRetry, className }: ErrorStateProps) {
  const text =
    message ?? (error instanceof ApiError ? error.message : 'Không tải được dữ liệu. Thử lại sau ít phút.')
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}
    >
      <p className="max-w-[60ch] font-medium text-destructive">{text}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> Thử lại
        </Button>
      ) : null}
    </div>
  )
}
