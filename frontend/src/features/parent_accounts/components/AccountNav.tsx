import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useParentLogout, useParentMe } from '../hooks'

const NAV_LINK =
  'inline-flex min-h-11 items-center rounded-md px-3 text-base font-medium text-muted-foreground outline-none hover:bg-accent hover:text-navy focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-accent data-[status=active]:text-navy'

export function AccountNav({ logoutOnMobile = false }: { logoutOnMobile?: boolean }) {
  const me = useParentMe()
  const logout = useParentLogout()

  return (
    <>
      <nav aria-label="Tài khoản" className="hidden items-center gap-1 lg:ml-6 lg:flex">
        <Link to="/parent" activeOptions={{ exact: true }} className={NAV_LINK}>
          Thông tin học sinh
        </Link>
        <Link to="/parent/children/new" className={NAV_LINK}>
          Thêm hồ sơ mới
        </Link>
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {me.data ? (
          <span className="hidden max-w-[220px] truncate text-[15px] text-muted-foreground lg:inline">
            {me.data.full_name}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className={cn('h-11 min-w-11 px-3 text-base', !logoutOnMobile && 'max-lg:hidden')}
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Đăng xuất</span>
        </Button>
      </div>
    </>
  )
}
