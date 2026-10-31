import { Link, useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'

const PARENT_AREAS = ['/parent', '/p/', '/survey']

function homeFor(pathname: string): string {
  if (pathname.startsWith('/facility')) return '/facility'
  return PARENT_AREAS.some((prefix) => pathname.startsWith(prefix)) ? '/parent' : '/dashboard'
}

export function NotFound() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <EmptyState
        title="Không tìm thấy trang"
        description="Trang này không tồn tại hoặc đã được chuyển."
        action={
          <Button asChild>
            <Link to={homeFor(pathname)}>Về trang chủ</Link>
          </Button>
        }
      />
    </div>
  )
}
