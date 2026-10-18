import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'

export function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <EmptyState
        title="Không tìm thấy trang"
        description="Đường dẫn không tồn tại hoặc đã được chuyển."
        action={
          <Button asChild>
            <Link to="/dashboard">Về Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
