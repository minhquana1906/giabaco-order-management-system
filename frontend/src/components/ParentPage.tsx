import { useId, type ReactNode } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-balance text-[26px] font-semibold leading-tight text-navy lg:text-[32px]">{children}</h1>
}

interface PageHeadProps {
  title: ReactNode
  meta?: ReactNode
  aside?: ReactNode
  divider?: boolean
}

export function PageHead({ title, meta, aside, divider = true }: PageHeadProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8',
        divider && 'border-b border-hairline pb-5 lg:pb-6',
      )}
    >
      <div className="min-w-0">
        <PageTitle>{title}</PageTitle>
        {meta ? <p className="mt-1 text-[17px] text-muted-foreground">{meta}</p> : null}
      </div>
      {aside}
    </header>
  )
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="-mb-3 -ml-3 h-11 self-start px-3 text-[15px] text-muted-foreground hover:text-navy lg:-mb-5"
      onClick={onClick}
    >
      <ChevronLeft /> {label}
    </Button>
  )
}

const STEP_LABELS = ['Thông tin', 'Chọn cỡ', 'Xác nhận']

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Các bước" className="flex items-center gap-2 sm:gap-3">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            data-focus-target={active ? '' : undefined}
            className="flex items-center gap-2 sm:gap-3"
          >
            {i > 0 ? <span aria-hidden="true" className={cn('h-px w-4 sm:w-10', n <= current ? 'bg-navy' : 'bg-input')} /> : null}
            <span
              aria-hidden="true"
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full border text-[15px] font-semibold',
                active && 'border-navy bg-navy text-white',
                done && 'border-navy bg-secondary text-navy',
                !active && !done && 'border-input bg-white text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : n}
            </span>
            <span
              className={cn(
                'text-[15px]',
                active ? 'font-semibold text-navy' : 'text-muted-foreground max-sm:sr-only',
              )}
            >
              <span className="sr-only">Bước {n}/3: </span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface PanelProps {
  title?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}

export function Panel({ title, action, footer, flush = false, className, children }: PanelProps) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        'flex min-w-0 flex-col',
        flush ? 'md:rounded-lg md:border md:border-hairline md:bg-white' : 'rounded-lg border border-hairline bg-white',
        className,
      )}
    >
      {title ? (
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline px-5 py-2">
          <h2 id={titleId} className="text-[18px] font-semibold text-navy">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={cn('flex flex-1 flex-col gap-5', flush ? 'md:p-6 lg:p-8' : 'p-5 lg:p-6')}>{children}</div>
      {footer ? <div className="flex flex-col gap-3 border-t border-hairline px-5 py-4 sm:flex-row sm:justify-end">{footer}</div> : null}
    </section>
  )
}

export function StatusPill({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <p
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-[15px] font-semibold',
        done ? 'border-success bg-success-soft text-success-ink' : 'border-input bg-white text-muted-foreground',
      )}
    >
      {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}
      {children}
    </p>
  )
}

export function StudentTag({
  name,
  detail,
  className,
}: {
  name: string
  detail: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg bg-navy px-6 py-5 before:pointer-events-none before:absolute before:inset-[5px] before:rounded-md before:border before:border-dashed before:border-brass/60 before:content-['']",
        className,
      )}
    >
      <p className="text-[26px] font-semibold leading-tight text-white">{name}</p>
      <p className="mt-1.5 text-[15px] text-sidebar-foreground">{detail}</p>
    </div>
  )
}

export function ActionBar({
  start,
  stack = false,
  className,
  children,
}: {
  start?: ReactNode
  stack?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-3 border-t border-hairline bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:-mx-6 md:px-6',
        'lg:static lg:mx-0 lg:mt-0 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-0 lg:pb-0 lg:pt-6',
        className,
      )}
    >
      {start}
      <div className={cn('flex gap-3 max-[360px]:flex-col-reverse max-[360px]:[&>*]:flex-none lg:ml-auto', stack && 'max-sm:flex-col-reverse max-sm:[&>*]:flex-none')}>{children}</div>
    </div>
  )
}
