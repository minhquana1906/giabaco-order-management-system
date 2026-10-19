import { Link } from '@tanstack/react-router'
import { ChevronRight, LogOut, Plus } from 'lucide-react'
import { Hotline, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { SizeLabel } from '@/components/SizeLabel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/http'
import type { ChildSummary } from '../api'
import { useChildren, useParentLogout, useParentMe } from '../hooks'

const productLabel = (code: string) => `${code.charAt(0).toUpperCase()}${code.slice(1)}`

function AddChildButton({ primary }: { primary: boolean }) {
  return (
    <Button asChild size="lg" variant={primary ? 'default' : 'outline'} className={PARENT_BTN}>
      <Link to="/parent/children/new">
        <Plus /> Thêm con
      </Link>
    </Button>
  )
}

function ChildCard({ child }: { child: ChildSummary }) {
  const picked = Object.entries(child.choices).sort(([a], [b]) => a.localeCompare(b))
  return (
    <li>
      <Link
        to="/parent/children/$studentId"
        params={{ studentId: child.student_id }}
        className="flex min-h-11 items-center gap-3 rounded-lg border border-hairline bg-white px-5 py-4 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-xl font-semibold leading-tight text-navy">{child.full_name}</p>
            <p className="text-[15px] text-muted-foreground">
              Lớp {child.class_name} · {child.school_name}
            </p>
          </div>
          {child.data_source === 'PARENT_DECLARED' ? (
            <p className="w-fit rounded-sm bg-secondary px-2 py-0.5 text-sm font-medium text-navy">Phụ huynh tự khai</p>
          ) : null}
          {picked.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Cỡ đã chọn">
              {picked.map(([code, size]) => (
                <li key={code} className="flex items-center gap-2 text-[15px]">
                  <span className="text-muted-foreground">{productLabel(code)}</span>
                  <SizeLabel label={size} scale="md" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] font-medium text-navy">Chưa chọn cỡ áo</p>
          )}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function ChildrenList() {
  const children = useChildren()
  const me = useParentMe()
  const logout = useParentLogout()

  const logoutButton = (
    <Button type="button" variant="ghost" className="h-11 text-base" disabled={logout.isPending} onClick={() => logout.mutate()}>
      <LogOut /> Đăng xuất
    </Button>
  )

  let body
  if (children.isPending) {
    body = (
      <div role="status" aria-label="Đang tải" className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  } else if (children.isError) {
    const offline = children.error instanceof ApiError && children.error.status === 0
    body = (
      <div role="alert" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-navy">Chưa tải được danh sách</h2>
        <p>{offline ? 'Không kết nối được. Kiểm tra mạng rồi thử lại.' : 'Có lỗi xảy ra, vui lòng thử lại.'}</p>
        <Button size="lg" className={PARENT_BTN} onClick={() => void children.refetch()}>
          Thử lại
        </Button>
        <Hotline />
      </div>
    )
  } else if (children.data.length === 0) {
    body = (
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-lg border border-dashed border-input bg-white px-5 py-6">
          <p className="text-lg font-semibold text-navy">Chưa có hồ sơ con</p>
          <p className="mt-1 text-muted-foreground">Thêm con để xem số đo và chọn cỡ áo G Blazer.</p>
        </div>
        <div className="mt-auto">
          <AddChildButton primary />
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <ul className="flex flex-col gap-3">
          {children.data.map((child) => (
            <ChildCard key={child.student_id} child={child} />
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3">
          <AddChildButton primary={false} />
          <Hotline />
        </div>
      </>
    )
  }

  return (
    <ParentShell actions={logoutButton}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-navy">Con của bạn</h1>
        {me.data ? <p className="text-muted-foreground">Xin chào, {me.data.full_name}.</p> : null}
      </div>
      {body}
    </ParentShell>
  )
}
