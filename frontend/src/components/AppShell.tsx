import { Link, useRouterState } from '@tanstack/react-router'
import { CalendarRange, ChartColumn, ChevronDown, Factory, LogOut, Menu, Package, Settings, ShoppingBag, Users } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useLogout, useMe } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

const NAV_ITEM =
  'relative flex items-center gap-2.5 rounded-none px-[22px] py-3 font-medium text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:py-2.5'
const NAV_LEAF = `${NAV_ITEM} pl-[46px] text-[13px]`
const NAV_ACTIVE =
  "bg-white/[0.14] hover:bg-white/[0.14] text-white before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brass before:content-['']"
const NAV_TREE =
  "relative flex flex-col before:absolute before:bottom-2 before:left-[29px] before:top-0 before:w-px before:bg-white/20 before:content-['']"

function NavGroup({ icon, label, active, children }: { icon: ReactNode; label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const expanded = open ?? active
  const id = useId()
  return (
    <li className="mt-2 first:mt-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setOpen(!expanded)}
        className={cn(NAV_ITEM, 'w-full font-semibold', active && 'text-white')}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul id={id} hidden={!expanded} className={NAV_TREE}>
        {children}
      </ul>
    </li>
  )
}

function Wordmark({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className="px-3">
        <p className="text-base font-bold tracking-[0.5px] text-white">
          G<span className="text-brass">-</span>UNIFORM
        </p>
        <p className="-mt-0.5 text-[11px] font-medium tracking-[1px] text-[#c9d0de]">
          by GIABACO · EDUCHIC
        </p>
      </div>
    )
  }

  return (
    <div className="px-[22px]">
      <p className="text-xl font-bold tracking-[0.5px] text-white">
        G<span className="text-brass">-</span>UNIFORM
      </p>
      <p className="-mt-0.5 text-[11px] font-medium tracking-[1.2px] text-[#c9d0de]">
        by GIABACO · EDUCHIC
      </p>
    </div>
  )
}

function useActive() {
  return useRouterState({ select: (s) => ({ pathname: s.location.pathname }) })
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useActive()
  const onStudents = pathname.startsWith('/students')
  const listActive = onStudents && pathname !== '/students/new'
  const isDashboard = pathname === '/dashboard'
  const isCatalog = pathname.startsWith('/catalog')
  const isCampaigns = pathname.startsWith('/campaigns')
  const isOrders = pathname.startsWith('/orders')
  return (
    <nav aria-label="Điều hướng chính">
      <ul className="flex flex-col">
        <NavGroup icon={<Users className="size-4" aria-hidden="true" />} label="Học sinh" active={onStudents}>
          <li>
            <Link
              to="/students/new"
              onClick={onNavigate}
              aria-current={pathname === '/students/new' ? 'page' : undefined}
              className={cn(NAV_LEAF, pathname === '/students/new' && NAV_ACTIVE)}
            >
              Thêm học sinh mới
            </Link>
          </li>
          <li>
            <Link
              to="/students"
              activeOptions={{ exact: true }}
              onClick={onNavigate}
              aria-current={listActive ? 'page' : undefined}
              className={cn(NAV_LEAF, listActive && NAV_ACTIVE)}
            >
              Danh sách học sinh
            </Link>
          </li>
        </NavGroup>
        <li className="mt-2">
          <Link
            to="/dashboard"
            search={isDashboard ? true : {}}
            onClick={onNavigate}
            aria-current={isDashboard ? 'page' : undefined}
            className={cn(NAV_ITEM, 'font-semibold', isDashboard && NAV_ACTIVE)}
          >
            <ChartColumn className="size-4" aria-hidden="true" /> Thống kê
          </Link>
        </li>
        <li>
          <Link
            to="/catalog"
            onClick={onNavigate}
            aria-current={isCatalog ? 'page' : undefined}
            className={cn(NAV_ITEM, 'font-semibold', isCatalog && NAV_ACTIVE)}
          >
            <Package className="size-4" aria-hidden="true" /> Sản phẩm
          </Link>
        </li>
        <li>
          <Link
            to="/campaigns"
            search={{}}
            onClick={onNavigate}
            aria-current={isCampaigns ? 'page' : undefined}
            className={cn(NAV_ITEM, 'font-semibold', isCampaigns && NAV_ACTIVE)}
          >
            <CalendarRange className="size-4" aria-hidden="true" /> Đợt đăng ký
          </Link>
        </li>
        <li>
          <Link
            to="/orders"
            search={{}}
            onClick={onNavigate}
            aria-current={isOrders ? 'page' : undefined}
            className={cn(NAV_ITEM, 'font-semibold', isOrders && NAV_ACTIVE)}
          >
            <ShoppingBag className="size-4" aria-hidden="true" /> Đơn hàng
          </Link>
        </li>
        <li>
          <Link
            to="/production"
            onClick={onNavigate}
            aria-current={pathname.startsWith('/production') ? 'page' : undefined}
            className={cn(NAV_ITEM, 'font-semibold', pathname.startsWith('/production') && NAV_ACTIVE)}
          >
            <Factory className="size-4" aria-hidden="true" /> Tiến độ đợt sản xuất
          </Link>
        </li>
        <NavGroup
          icon={<Settings className="size-4" aria-hidden="true" />}
          label="Cấu hình"
          active={pathname.startsWith('/settings') || pathname.startsWith('/master-data')}
        >
          <li>
            <Link
              to="/settings/schools"
              onClick={onNavigate}
              aria-current={pathname.startsWith('/settings/schools') ? 'page' : undefined}
              className={cn(NAV_LEAF, pathname.startsWith('/settings/schools') && NAV_ACTIVE)}
            >
              Trường và lớp
            </Link>
          </li>
          <li>
            <Link
              to="/master-data"
              onClick={onNavigate}
              aria-current={pathname.startsWith('/master-data') ? 'page' : undefined}
              className={cn(NAV_LEAF, pathname.startsWith('/master-data') && NAV_ACTIVE)}
            >
              Danh mục gốc
            </Link>
          </li>
        </NavGroup>
      </ul>
    </nav>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe()
  const logout = useLogout()
  return (
    <div className="on-navy flex h-full flex-col pb-[18px] pt-[22px] text-sidebar-foreground">
      <div className="pb-6">
        <Wordmark />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="px-[22px] pt-4 text-[13px]">
        <p className="font-semibold text-white">{me.data?.username ?? 'admin'}</p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="-ml-2 mt-1 inline-flex min-h-10 w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" /> Đăng xuất
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Bỏ qua đến nội dung
      </a>

      <aside className="sticky top-0 hidden h-dvh w-[220px] flex-none border-r border-piping bg-navy lg:block">
        <SidebarBody />
      </aside>

      <header className="on-navy sticky top-0 z-30 flex h-14 items-center justify-between border-b border-piping bg-navy pl-0 pr-2 lg:hidden">
        <Wordmark inline />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Mở menu"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[260px] max-w-[85vw] gap-0 border-r border-piping bg-navy p-0"
          >
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Điều hướng G-UNIFORM</SheetDescription>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-4 md:px-7">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
    </div>
  )
}
