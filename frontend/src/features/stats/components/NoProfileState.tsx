import { Link } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

export function NoProfileState({ schoolId, title = 'Trường chưa có danh mục sản phẩm' }: { schoolId?: string; title?: string }) {
  return (
    <EmptyState
      title={title}
      description="Danh mục sản phẩm của trường lấy từ các đợt đăng ký. Một đợt nháp là đủ."
      action={
        <Button asChild>
          <Link to="/campaigns" search={schoolId ? { school_id: schoolId } : {}}>
            Tạo đợt đăng ký
          </Link>
        </Button>
      }
    />
  )
}
