import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const HOTLINE = '0835352004'
export const SUPPORT_EMAIL = 'Guniform2026@gmail.com'

export const PARENT_BTN = 'h-[52px] w-full text-[17px]'

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
      {lead} Gọi{' '}
      <a className="inline-flex min-h-11 items-center font-semibold text-navy underline" href={`tel:${HOTLINE}`}>
        {HOTLINE}
      </a>
    </p>
  )
}

interface ParentShellProps {
  children: ReactNode
  actions?: ReactNode
  onBack?: () => void
  backLabel?: string
  focusKey?: string
}

export function ParentShell({ children, actions, onBack, backLabel = 'Các con của bạn', focusKey }: ParentShellProps) {
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
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-[480px] items-center gap-3 px-4 py-3">
          <img src="/brand/logo-giabaco.png" alt="Giabaco" className="h-9 w-auto shrink-0" />
          <span className="whitespace-nowrap text-sm font-semibold tracking-[0.18em] sm:text-base text-navy">G-UNIFORM</span>
          {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
        </div>
      </header>
      <main ref={mainRef} className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 px-4 py-6 [&_h1:focus]:outline-none">
        {onBack ? (
          <Button type="button" variant="ghost" className="-ml-3 -mb-2 h-11 self-start px-3 text-base" onClick={onBack}>
            <ChevronLeft /> {backLabel}
          </Button>
        ) : null}
        {children}
      </main>
    </div>
  )
}
