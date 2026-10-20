import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const HOTLINE = '0835352004'
const SUPPORT_EMAIL = 'Guniform2026@gmail.com'

export const PARENT_BTN = 'h-[52px] w-full text-[17px]'
export const PARENT_BTN_INLINE = `${PARENT_BTN} lg:w-auto lg:min-w-[220px]`
export const PARENT_ACTIONS = 'mt-auto flex flex-col gap-3 lg:mt-0 lg:flex-row-reverse lg:justify-start'
export const PARENT_CONTROL = 'h-12 text-[17px]'

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

export function Hotline({ lead = 'Cần hỗ trợ?' }: { lead?: string }) {
  return (
    <p className="text-muted-foreground">
      <span className="block">{lead}</span>
      <span className="block">
        Vui lòng liên hệ Giabaco (
        <a className="inline-flex min-h-11 items-center font-semibold text-navy underline" href={`tel:${HOTLINE}`}>
          {HOTLINE}
        </a>
        ).
      </span>
    </p>
  )
}

export function ParentHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold text-navy lg:text-3xl">{title}</h1>
      {children ? <p className="text-balance text-muted-foreground">{children}</p> : null}
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
      <Hotline />
    </div>
  )
}

type ParentWidth = 'sm' | 'md' | 'lg'

const MAIN_WIDTH: Record<ParentWidth, string> = {
  sm: 'lg:max-w-[520px]',
  md: 'lg:max-w-[760px]',
  lg: 'lg:max-w-[1040px]',
}

interface ParentShellProps {
  children: ReactNode
  actions?: ReactNode
  onBack?: () => void
  backLabel?: string
  focusKey?: string
  width?: ParentWidth
  panel?: boolean
}

export function ParentShell({
  children,
  actions,
  onBack,
  backLabel = 'Thông tin học sinh',
  focusKey,
  width = 'sm',
  panel = false,
}: ParentShellProps) {
  const mainRef = useRef<HTMLElement>(null)
  const firstKey = useRef(focusKey)

  useEffect(() => {
    if (focusKey === firstKey.current) return
    const heading = mainRef.current?.querySelector('h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [focusKey])

  return (
    <div className="flex min-h-dvh flex-col bg-background text-[17px] leading-relaxed">
      <header className="border-b border-hairline bg-white lg:border-b-[3px] lg:border-piping">
        <div className="mx-auto flex max-w-[480px] items-center gap-3 px-4 py-3 lg:max-w-[1040px] lg:px-8 lg:py-3.5">
          <img src="/brand/logo-giabaco.png" alt="Giabaco" className="h-9 w-auto shrink-0" />
          <span className="whitespace-nowrap text-sm font-semibold tracking-[0.18em] sm:text-base text-navy">
            G-UNIFORM
          </span>
          {actions}
        </div>
      </header>
      <main
        ref={mainRef}
        className={cn(
          'mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-4 py-6 lg:gap-8 lg:px-8 lg:py-10 [&_h1:focus]:outline-none',
          MAIN_WIDTH[width],
        )}
      >
        {onBack ? (
          <Button type="button" variant="ghost" className="-ml-3 -mb-2 h-11 self-start px-3 text-base" onClick={onBack}>
            <ChevronLeft /> {backLabel}
          </Button>
        ) : null}
        <div
          className={cn(
            'flex flex-1 flex-col gap-6',
            panel && 'lg:my-auto lg:flex-none lg:rounded-lg lg:border lg:border-hairline lg:bg-white lg:p-8',
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
