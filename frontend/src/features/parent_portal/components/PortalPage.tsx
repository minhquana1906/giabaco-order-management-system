import { useEffect, useState, type ReactNode } from 'react'
import { Check, CheckCircle2, Ruler } from 'lucide-react'
import { ContactActions, Hotline, PARENT_BTN, ParentHeading, ParentShell } from '@/components/ParentShell'
import { SizeLabel } from '@/components/SizeLabel'
import { FIT_LABEL } from '@/lib/fit'
import { formatCm, formatDate, formatDateTime, formatKg, formatNumber } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_COLOUR, colourLabel, type ProductColour } from '@/lib/productColour'
import type { PortalSource, PublicProduct, PublicStudent } from '../api'
import { derivedSize, initialPicks, initialStep, pickChanges, type Picks } from '../choices'
import { usePortalStudent, useSaveChoices } from '../hooks'
import { SIZE_CHARTS } from '../sizeCharts'
import { ColourSelect } from './ColourSelect'
import { ProductImageButton } from './ProductImageButton'

type Step = 'identity' | 'help' | 'measure' | 'choose' | 'review' | 'overview'

type Success = { savedAt?: string; first: boolean }

const STEP_LABELS = ['Thông tin', 'Chọn cỡ', 'Xác nhận']

function StepDots({ n }: { n: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Bước ${n}/3: ${STEP_LABELS[n - 1]}`}>
      <span className="text-sm font-medium text-muted-foreground">
        Bước {n}/3 · {STEP_LABELS[n - 1]}
      </span>
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'size-3 rounded-full border border-brass',
              i <= n ? 'bg-brass' : 'bg-transparent',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export interface NotFoundCopy {
  title: string
  text: string
}

const LINK_NOT_FOUND: NotFoundCopy = {
  title: 'Liên kết không hợp lệ',
  text: 'Liên kết này không đúng hoặc đã hết hiệu lực. Vui lòng liên hệ nhân viên Giabaco.',
}

function Problem({ error, notFound, onRetry }: { error: unknown; notFound: NotFoundCopy; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 404) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-navy">{notFound.title}</h1>
        <p>{notFound.text}</p>
        <ContactActions />
      </>
    )
  }
  const text = requestErrorMessage(error, 'Có lỗi xảy ra, vui lòng thử lại.')
  return (
    <div role="alert" className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-navy">Chưa tải được trang</h1>
      <p>{text}</p>
      <Button size="lg" className={PARENT_BTN} onClick={onRetry}>
        Thử lại
      </Button>
      <Hotline />
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function StudentTag({ s }: { s: PublicStudent }) {
  return (
    <div className="relative rounded-lg bg-navy px-6 py-5 before:pointer-events-none before:absolute before:inset-[5px] before:rounded-md before:border before:border-dashed before:border-brass/60 before:content-['']">
      <p className="text-[26px] font-semibold leading-tight text-white">{s.full_name}</p>
      <p className="mt-1.5 text-[15px] text-sidebar-foreground">
        Lớp {s.class_name} · {s.school_name}
      </p>
    </div>
  )
}

function Identity({ s, onYes, onNo }: { s: PublicStudent; onYes: () => void; onNo: () => void }) {
  return (
    <>
      <ParentHeading title="Đây có phải con của bạn?">Xác nhận đúng học sinh để xem số đo và chọn cỡ áo cho con.</ParentHeading>
      <StudentTag s={s} />
      <div className="mt-auto flex flex-col gap-3">
        <Button size="lg" className={PARENT_BTN} onClick={onYes}>
          Đúng, tiếp tục
        </Button>
        <Button variant="outline" size="lg" className={PARENT_BTN} onClick={onNo}>
          Không phải con tôi
        </Button>
      </div>
    </>
  )
}

function Help({ onBack }: { onBack: () => void }) {
  return (
    <>
      <h1 className="text-xl font-semibold text-navy">Vui lòng liên hệ nhân viên Giabaco để được hỗ trợ</h1>
      <p className="text-muted-foreground">Chúng tôi sẽ kiểm tra và gửi lại đúng liên kết cho bạn.</p>
      <div className="mt-auto flex flex-col gap-3">
        <ContactActions />
        <Button variant="ghost" size="lg" className={PARENT_BTN} onClick={onBack}>
          Quay lại
        </Button>
      </div>
    </>
  )
}

function Measurements({ s, onNext, onEdit }: { s: PublicStudent; onNext: () => void; onEdit?: () => void }) {
  const byProduct = s.products
    .map((p) => ({
      p,
      trials: s.trials
        .filter((t) => t.product_code === p.code)
        .sort((a, b) => p.sizes.indexOf(a.size_label) - p.sizes.indexOf(b.size_label)),
    }))
    .filter((x) => x.trials.length > 0)
  return (
    <>
      <StepDots n={1} />
      <h1 className="text-xl font-semibold text-navy">Số đo của con</h1>
      <dl className="rounded-lg border border-hairline bg-white px-5 py-2">
        <Row label="Chiều cao">{formatCm(s.height_cm)}</Row>
        <Row label="Cân nặng">{formatKg(s.weight_kg)}</Row>
        <Row label={s.data_source === 'PARENT_DECLARED' ? 'Ngày khai' : 'Ngày đo'}>{formatDate(s.measured_at)}</Row>
      </dl>
      {byProduct.length === 0 ? (
        s.data_source === 'PARENT_DECLARED' ? (
          <div className="rounded-lg border border-hairline bg-white px-5 py-4">
            <p className="font-semibold text-navy">Phụ huynh tự khai</p>
            <p className="text-muted-foreground">Số đo do bạn khai, chưa có kết quả thử áo.</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Chưa có lần thử áo nào được ghi nhận.</p>
        )
      ) : (
        byProduct.map(({ p, trials }) => (
          <section key={p.code} className="flex flex-col gap-2">
            <h2 className="font-semibold text-navy">{p.name}</h2>
            <ul className="rounded-lg border border-hairline bg-white px-5">
              {trials.map((t) => (
                <li
                  key={t.size_label}
                  className="flex items-center justify-between border-b border-hairline py-3 last:border-0"
                >
                  <SizeLabel label={t.size_label} scale="lg" />
                  <span className="font-medium">{FIT_LABEL[t.fit]}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <div className="mt-auto">
        <Button size="lg" className={PARENT_BTN} onClick={onNext}>
          Tiếp tục
        </Button>
        {onEdit ? (
          <Button variant="outline" size="lg" className={`${PARENT_BTN} mt-3`} onClick={onEdit}>
            Sửa thông tin
          </Button>
        ) : null}
      </div>
    </>
  )
}

function SizeChartButton({ product, selected, className }: { product: PublicProduct; selected?: string; className?: string }) {
  const chart = SIZE_CHARTS[product.code]
  if (!chart) return null
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn('h-11 self-start', className)}>
          <Ruler /> Xem bảng thông số
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-3 p-4 sm:p-6">
        <DialogTitle className="px-8 text-center text-lg text-navy">Bảng thông số {product.name}</DialogTitle>
        <DialogDescription className="text-center">Đơn vị: cm</DialogDescription>
        <table className="w-full table-fixed border-collapse text-center text-[15px] tabular-nums">
          <colgroup>
            <col className="w-[60px]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-navy">
              <th scope="col" className="pb-2 text-sm font-semibold text-muted-foreground">
                Cỡ
              </th>
              {chart.columns.map((c) => (
                <th key={c.label} scope="col" className="px-1 pb-2 align-bottom text-sm font-semibold leading-tight text-navy">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {product.sizes.map((size, i) => (
              <tr
                key={size}
                className={cn('border-b border-hairline last:border-0', size === selected && 'bg-accent font-semibold')}
              >
                <th scope="row" className="py-2">
                  <SizeLabel label={size} />
                </th>
                {chart.columns.map((c) => (
                  <td key={c.label} className="px-1 py-2">
                    {c.values[i] === undefined ? '—' : formatNumber(c.values[i], 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-center text-sm text-muted-foreground">{chart.notes}</p>
      </DialogContent>
    </Dialog>
  )
}

function Choose({
  s,
  initial,
  onBack,
  onNext,
}: {
  s: PublicStudent
  initial: Picks
  onBack: () => void
  onNext: (picks: Picks) => void
}) {
  const [picks, setPicks] = useState<Picks>(initial)
  const [colours, setColours] = useState<Record<string, ProductColour>>(() =>
    Object.fromEntries(s.products.map((p) => [p.code, initial[p.code]?.colour ?? DEFAULT_COLOUR])),
  )
  const setSize = (code: string, size: string) =>
    setPicks((v) => ({ ...v, [code]: { size_label: size, colour: colours[code] ?? DEFAULT_COLOUR } }))
  const setColour = (code: string, colour: ProductColour) => {
    setColours((v) => ({ ...v, [code]: colour }))
    setPicks((v) => {
      const current = v[code]
      return current ? { ...v, [code]: { ...current, colour } } : v
    })
  }
  const answered = s.products.every((p) => picks[p.code] !== undefined)
  const hasSaved = Object.keys(s.choices).length > 0
  const unchanged = Object.keys(pickChanges(s.products, picks, s.choices)).length === 0
  const anySize = s.products.some((p) => picks[p.code])
  const hint = !answered
    ? null
    : hasSaved && unchanged
      ? 'Lựa chọn chưa thay đổi.'
      : !hasSaved && !anySize
        ? 'Chưa chọn cỡ cho sản phẩm nào.'
        : null
  const ready = answered && !hint
  return (
    <>
      <StepDots n={2} />
      <h1 className="text-xl font-semibold text-navy">Chọn cỡ đăng ký</h1>
      {s.products.map((p) => {
        const suggested = derivedSize(p, s.trials)
        const guide = s.data_source === 'PARENT_DECLARED' ? (s.suggested_sizes[p.code] ?? null) : null
        const labelId = `prod-${p.code}`
        const colourId = `colour-label-${p.code}`
        const sizeId = `size-label-${p.code}`
        const pick = picks[p.code]
        const colour = colours[p.code] ?? DEFAULT_COLOUR
        return (
          <section key={p.code} className="flex flex-col gap-3 rounded-lg border border-hairline bg-white p-4">
            <h2 id={labelId} className="font-semibold text-navy">
              {p.name}
            </h2>
            {guide ? (
              <p className="-mt-1 text-[15px] text-muted-foreground">
                Gợi ý theo bảng cỡ: <span className="font-semibold text-navy">Cỡ {guide}</span>
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <SizeChartButton product={p} selected={pick?.size_label} className="w-full px-2 text-sm" />
              <ProductImageButton product={p} gender={s.gender} colour={colour} className="w-full px-2 text-sm" />
            </div>
            <p id={colourId} className="text-sm font-medium text-muted-foreground">
              Màu sắc
            </p>
            <ColourSelect productCode={p.code} labelledBy={`${labelId} ${colourId}`} value={colour} onChange={(c) => setColour(p.code, c)} />
            <p id={sizeId} className="text-sm font-medium text-muted-foreground">
              Cỡ
            </p>
            <div role="radiogroup" aria-labelledby={`${labelId} ${sizeId}`} className="grid grid-cols-3 gap-2">
              {p.sizes.map((size) => {
                const on = pick?.size_label === size
                const hintText =
                  suggested === size ? 'Nhân viên đo thấy vừa' : guide === size ? 'Gợi ý theo bảng cỡ' : null
                return (
                  <label
                    key={size}
                    className={cn(
                      'relative flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-1 text-lg font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                      on ? 'border-2 border-navy bg-navy text-white' : 'border-input bg-card hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={p.code}
                      value={size}
                      checked={on}
                      onChange={() => setSize(p.code, size)}
                    />
                    <span>Cỡ {size}</span>
                    {hintText ? (
                      <span className={cn('text-[11px] font-medium leading-tight', on ? 'text-brass' : 'text-navy')}>
                        {hintText}
                      </span>
                    ) : null}
                    {on ? (
                      <Check className="absolute right-1 top-1 size-4 text-brass" strokeWidth={3} aria-hidden="true" />
                    ) : null}
                  </label>
                )
              })}
            </div>
            <label
              className={cn(
                'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-md border px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                pick === null ? 'border-2 border-navy font-semibold' : 'border-input',
              )}
            >
              <input
                type="radio"
                className="size-5 accent-[var(--navy)]"
                name={p.code}
                value=""
                checked={pick === null}
                onChange={() => setPicks((v) => ({ ...v, [p.code]: null }))}
              />
              Không đăng ký sản phẩm này
            </label>
          </section>
        )
      })}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-hairline bg-background/95 px-4 py-3 backdrop-blur">
        <div aria-live="polite">
          {hint ? <p className="text-center text-[15px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Button variant="outline" size="lg" className="h-[52px] text-[17px]" onClick={onBack}>
            Quay lại
          </Button>
          <Button size="lg" className="h-[52px] text-[17px]" disabled={!ready} onClick={() => onNext(picks)}>
            Tiếp tục
          </Button>
        </div>
      </div>
    </>
  )
}

function ChoiceValue({ size, colour }: { size: string; colour: ProductColour | null }) {
  const label = colourLabel(colour)
  return (
    <span className="flex shrink-0 items-center gap-2">
      <SizeLabel label={size} scale="lg" />
      {label ? <span className="text-[15px] font-medium text-navy">{label}</span> : null}
    </span>
  )
}

function SelectionCard({ s, picks }: { s: PublicStudent; picks: Picks }) {
  return (
    <div className="rounded-lg border border-hairline bg-white px-5 py-4">
      <p className="text-[22px] font-semibold leading-tight text-navy">{s.full_name}</p>
      <p className="text-muted-foreground">Lớp {s.class_name}</p>
      <ul className="mt-2">
        {s.products.map((p) => {
          const pick = picks[p.code]
          return (
            <li
              key={p.code}
              className="flex items-center justify-between gap-3 border-b border-hairline py-3 last:border-0"
            >
              <span className="flex flex-col items-start gap-1">
                {p.name}
                <ProductImageButton product={p} gender={s.gender} colour={pick?.colour ?? DEFAULT_COLOUR} className="h-11 px-3 text-sm" />
              </span>
              {pick ? <ChoiceValue size={pick.size_label} colour={pick.colour} /> : <span className="text-muted-foreground">Không đăng ký</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Review({
  s,
  picked,
  pending,
  error,
  onBack,
  onConfirm,
}: {
  s: PublicStudent
  picked: Picks
  pending: boolean
  error: unknown
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <StepDots n={3} />
      <h1 className="text-xl font-semibold text-navy">Xác nhận lựa chọn</h1>
      <p className="text-muted-foreground">Vui lòng kiểm tra lại trước khi đăng ký.</p>
      <SelectionCard s={s} picks={picked} />
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {requestErrorMessage(error, 'Chưa lưu được lựa chọn. Vui lòng thử lại.')}
        </p>
      ) : null}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t border-hairline bg-background/95 px-4 py-3 backdrop-blur">
        <Button size="lg" className={PARENT_BTN} disabled={pending} onClick={onConfirm}>
          {pending ? 'Đang lưu…' : 'Xác nhận đăng ký'}
        </Button>
        <Button variant="outline" size="lg" className={PARENT_BTN} disabled={pending} onClick={onBack}>
          Quay lại sửa
        </Button>
      </div>
    </>
  )
}

function Overview({ s, onChange, onEdit }: { s: PublicStudent; onChange: () => void; onEdit?: () => void }) {
  const count = s.products.filter((p) => s.choices[p.code]).length
  return (
    <>
      <ParentHeading title={count ? 'Cỡ áo đã đăng ký' : 'Chưa đăng ký cỡ áo'}>
        {count ? 'Giabaco đã nhận lựa chọn cỡ của con bạn.' : 'Bạn chưa chọn cỡ cho sản phẩm nào của con.'}
      </ParentHeading>
      <StudentTag s={s} />
      <section aria-labelledby="chosen-title" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="chosen-title" className="font-semibold text-navy">
            Cỡ đã chọn
          </h2>
          <span className="text-[15px] tabular-nums text-muted-foreground">
            {count}/{s.products.length} sản phẩm
          </span>
        </div>
        <ul className="rounded-lg border border-hairline bg-white px-5">
          {s.products.map((p) => {
            const choice = s.choices[p.code]
            const measured = derivedSize(p, s.trials)
            return (
              <li
                key={p.code}
                className="flex items-center justify-between gap-4 border-b border-hairline py-4 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  {measured ? (
                    <span className="text-sm text-muted-foreground">Nhân viên đo thấy vừa Cỡ {measured}</span>
                  ) : null}
                </div>
                {choice ? (
                  <ChoiceValue size={choice.size_label} colour={choice.colour} />
                ) : (
                  <span className="shrink-0 text-muted-foreground">Không đăng ký</span>
                )}
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-labelledby="measure-title" className="flex flex-col gap-2">
        <h2 id="measure-title" className="font-semibold text-navy">
          Số đo của con
        </h2>
        <dl className="grid grid-cols-3 divide-x divide-hairline rounded-lg border border-hairline bg-white">
          {[
            ['Chiều cao', formatCm(s.height_cm)],
            ['Cân nặng', formatKg(s.weight_kg)],
            [s.data_source === 'PARENT_DECLARED' ? 'Ngày khai' : 'Ngày đo', formatDate(s.measured_at)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 px-3 py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-semibold tabular-nums text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="mt-auto flex flex-col gap-3">
        <Button size="lg" className={PARENT_BTN} onClick={onChange}>
          Đổi lựa chọn
        </Button>
        {onEdit ? (
          <Button variant="outline" size="lg" className={PARENT_BTN} onClick={onEdit}>
            Sửa thông tin
          </Button>
        ) : null}
        <Hotline />
      </div>
    </>
  )
}

function SuccessDialog({ success, onClose }: { success: Success | null; onClose: () => void }) {
  return (
    <Dialog open={success !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className="max-w-[400px] gap-4 p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-navy" strokeWidth={1.5} aria-hidden="true" />
        <DialogTitle className="text-center text-2xl text-navy">
          {success?.first ? 'Đăng ký thành công' : 'Đã cập nhật lựa chọn'}
        </DialogTitle>
        <DialogDescription className="text-balance text-center text-base">
          Giabaco đã nhận lựa chọn cỡ của con bạn.
        </DialogDescription>
        {success?.savedAt ? (
          <p className="-mt-2 text-sm tabular-nums text-muted-foreground">
            Ghi nhận lúc {formatDateTime(success.savedAt)}
          </p>
        ) : null}
        <DialogClose asChild>
          <Button size="lg" className={PARENT_BTN}>
            Xem thông tin đăng ký
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

interface PortalPageProps {
  source: PortalSource
  skipIdentity?: boolean
  notFound?: NotFoundCopy
  onBack?: () => void
  onEdit?: () => void
}

export function PortalPage({ source, skipIdentity = false, notFound = LINK_NOT_FOUND, onBack, onEdit }: PortalPageProps) {
  const query = usePortalStudent(source)
  const save = useSaveChoices(source)
  const [stepState, setStep] = useState<Step | null>(null)
  const [picked, setPicked] = useState<Picks | null>(null)
  const [success, setSuccess] = useState<Success | null>(null)

  useEffect(() => {
    document.title = 'Chọn cỡ áo · G-UNIFORM'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  const s = query.data
  const step = stepState ?? (s ? initialStep(Object.keys(s.choices).length > 0, skipIdentity) : 'identity')
  const editDeclared = s?.data_source === 'PARENT_DECLARED' ? onEdit : undefined

  const submit = () => {
    if (!s || !picked) return
    const changes = pickChanges(s.products, picked, s.choices)
    const first = Object.keys(s.choices).length === 0
    save.mutate(changes, {
      onSuccess: (savedAt) => {
        setStep('overview')
        setSuccess({ savedAt, first })
      },
    })
  }

  const edit = () => {
    setPicked(null)
    setStep('choose')
  }

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div role="status" aria-label="Đang tải" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[52px] w-full" />
      </div>
    )
  } else if (query.isError || !s) {
    body = <Problem error={query.error} notFound={notFound} onRetry={() => void query.refetch()} />
  } else if (step === 'help') {
    body = <Help onBack={() => setStep('identity')} />
  } else if (step === 'identity') {
    body = <Identity s={s} onYes={() => setStep('measure')} onNo={() => setStep('help')} />
  } else if (step === 'measure') {
    body = <Measurements s={s} onNext={() => setStep('choose')} onEdit={editDeclared} />
  } else if (step === 'choose') {
    body = (
      <Choose
        s={s}
        initial={picked ?? initialPicks(s.products, s.choices)}
        onBack={() => setStep(Object.keys(s.choices).length > 0 ? 'overview' : 'measure')}
        onNext={(p) => {
          save.reset()
          setPicked(p)
          setStep('review')
        }}
      />
    )
  } else if (step === 'review' && picked) {
    body = (
      <Review
        s={s}
        picked={picked}
        pending={save.isPending}
        error={save.error}
        onBack={() => setStep('choose')}
        onConfirm={submit}
      />
    )
  } else {
    body = <Overview s={s} onChange={edit} onEdit={editDeclared} />
  }

  return (
    <ParentShell onBack={onBack} focusKey={step}>
      {body}
      <SuccessDialog success={success} onClose={() => setSuccess(null)} />
    </ParentShell>
  )
}
