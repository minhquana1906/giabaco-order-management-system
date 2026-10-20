import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const HOTLINE = '0835352004'
const SUPPORT_EMAIL = 'Guniform2026@gmail.com'

export const PARENT_BTN = 'h-[52px] w-full text-[17px]'
export const PARENT_ACTION = 'h-[52px] min-w-0 flex-1 px-5 text-[17px] lg:min-w-[180px] lg:flex-none'
export const PARENT_ACTION_PRIMARY = `${PARENT_ACTION} max-lg:flex-[2] lg:min-w-[220px]`
export const PARENT_CONTROL = 'h-12 text-[17px] md:h-12 md:text-[17px]'

export function ContactActions() {
  return (
    <div className="flex flex-col gap-3">
      <Button asChild size="lg" className={PARENT_BTN}>
        <a href={`tel:${HOTLINE}`}>
          <Phone /> Gọi {HOTLINE}
        </a>
      </Button>
      <Button asChild variant="outline" size="lg" className={PARENT_BTN}>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail /> {SUPPORT_EMAIL}
        </a>
      </Button>
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-4">
      <p className="font-medium text-destructive">{message}</p>
      <Button size="lg" className={PARENT_BTN} onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}

type ParentWidth = 'narrow' | 'form' | 'wide'

const MAIN_WIDTH: Record<ParentWidth, string> = {
  narrow: 'max-w-[480px] md:max-w-[520px]',
  form: 'max-w-[760px]',
  wide: 'max-w-[1120px]',
}

const CONTAINER = 'mx-auto w-full max-w-[1120px] px-4 md:px-6 lg:px-8'

function Brand() {
  return (
    <div className="shrink-0 leading-none">
      <p className="text-lg font-bold tracking-[0.5px] text-white lg:text-xl">
        G<span className="text-brass">-</span>UNIFORM
      </p>
      <p className="mt-1 text-[11px] font-medium tracking-[1px] text-[#c9d0de] lg:tracking-[1.2px]">
        by GIABACO · EDUCHIC
      </p>
    </div>
  )
}

function ParentFooter() {
  const link =
    'inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-navy outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <footer className="border-t border-hairline bg-white">
      <div
        className={cn(CONTAINER, 'flex flex-col gap-1 py-3 text-[15px] sm:flex-row sm:items-center sm:justify-between')}
      >
        <img src="/brand/logo-giabaco.png" alt="Giabaco" width={360} height={129} className="h-9 w-auto self-start" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
          <a href={`tel:${HOTLINE}`} className={link}>
            <Phone className="size-4 text-muted-foreground" aria-hidden="true" /> Hotline {HOTLINE}
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
            <Mail className="size-4 text-muted-foreground" aria-hidden="true" /> {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  )
}

interface ParentShellProps {
  children: ReactNode
  actions?: ReactNode
  focusKey?: string
  width?: ParentWidth
  center?: boolean
}

export function ParentShell({ children, actions, focusKey, width = 'narrow', center = false }: ParentShellProps) {
  const mainRef = useRef<HTMLElement>(null)
  const firstKey = useRef(focusKey)

  useEffect(() => {
    if (focusKey === firstKey.current) return
    const target =
      mainRef.current?.querySelector<HTMLElement>('[data-focus-target]') ??
      mainRef.current?.querySelector<HTMLElement>('h1')
    target?.setAttribute('tabindex', '-1')
    target?.focus()
  }, [focusKey])

  const brand = actions ? (
    <Link to="/parent" aria-label="G-UNIFORM" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Brand />
    </Link>
  ) : (
    <Brand />
  )

  return (
    <div className="flex min-h-dvh flex-col bg-background text-[17px] leading-relaxed">
      <header className="on-navy border-b-[3px] border-piping bg-navy">
        <div className={cn(CONTAINER, 'flex h-14 items-center gap-3 lg:h-16')}>
          {brand}
          {actions}
        </div>
      </header>
      <main
        ref={mainRef}
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:gap-8 lg:px-8 lg:py-10 [&_[tabindex="-1"]:focus]:outline-none',
          MAIN_WIDTH[width],
          center && 'lg:justify-center',
        )}
      >
        {children}
      </main>
      <ParentFooter />
    </div>
  )
}
