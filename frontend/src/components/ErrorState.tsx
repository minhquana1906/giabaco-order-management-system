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
    message ??
    (error instanceof ApiError
      ? error.message
      : 'Chưa tải được dữ liệu. Bấm Thử lại hoặc quay lại sau ít phút.')
  // A server fault carries a reference that the Giabaco team can look up in the logs.
  const reference = error instanceof ApiError && error.status >= 500 ? error.requestId : undefined
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}
    >
      <p className="max-w-[60ch] font-medium text-destructive">{text}</p>
      {reference ? (
        <p className="text-sm text-muted-foreground">
          Nếu lỗi lặp lại, vui lòng gửi mã tham chiếu <span className="select-all font-medium">{reference}</span>{' '}
          cho Giabaco.
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> Thử lại
        </Button>
      ) : null}
    </div>
  )
}
