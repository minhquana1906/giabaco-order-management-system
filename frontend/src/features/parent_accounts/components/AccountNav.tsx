import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initialsOf } from '../authLogic'
import { useParentLogout, useParentMe } from '../hooks'

export type AccountSection = 'list' | 'add'

const NAV_LINK =
  "relative hidden h-full items-center px-4 text-[15px] font-medium text-sidebar-foreground outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:flex aria-[current=page]:bg-white/[0.08] aria-[current=page]:text-white aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-[3px] aria-[current=page]:after:bg-brass aria-[current=page]:after:content-['']"

const MENU_ITEM = 'min-h-11 gap-3 px-3 text-[15px]'

export function AccountNav({ current }: { current: AccountSection }) {
  const me = useParentMe()
  const logout = useParentLogout()
  const name = me.data?.full_name ?? ''

  return (
    <>
      <nav aria-label="Tài khoản" className="ml-4 hidden h-full md:flex lg:ml-8">
        <Link to="/parent" aria-current={current === 'list' ? 'page' : undefined} className={NAV_LINK}>
          Thông tin học sinh
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        <Button asChild variant="secondary" className="hidden h-10 px-4 text-[15px] md:inline-flex">
          <Link to="/parent/children/new" aria-current={current === 'add' ? 'page' : undefined}>
            <Plus /> Thêm hồ sơ mới
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={name ? `Tài khoản ${name}` : 'Tài khoản'}
              className="flex h-11 items-center gap-2 rounded-md px-1.5 text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-white/10 md:pr-2.5"
            >
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full border border-white/25 bg-white/10 text-sm font-semibold"
              >
                {initialsOf(name)}
              </span>
              <span className="hidden max-w-[180px] truncate text-[15px] font-medium md:inline">{name}</span>
              <ChevronDown className="size-4 text-sidebar-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 shadow-none">
            {name ? (
              <DropdownMenuLabel className="truncate px-3 py-2 text-[15px] font-semibold text-navy">
                {name}
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={`${MENU_ITEM} md:hidden`}>
              <Link to="/parent" aria-current={current === 'list' ? 'page' : undefined}>
                Thông tin học sinh
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={`${MENU_ITEM} md:hidden`}>
              <Link to="/parent/children/new" aria-current={current === 'add' ? 'page' : undefined}>
                <Plus /> Thêm hồ sơ mới
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuItem className={MENU_ITEM} disabled={logout.isPending} onSelect={() => logout.mutate()}>
              <LogOut /> Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
