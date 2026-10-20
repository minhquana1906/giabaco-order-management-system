import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Ruler } from 'lucide-react'
import {
  ActionBar,
  BackLink,
  PageHead,
  PageTitle,
  Panel,
  StatusPill,
  Stepper,
  StudentTag,
} from '@/components/ParentPage'
import { ContactActions, PARENT_ACTION, PARENT_ACTION_PRIMARY, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { SizeLabel } from '@/components/SizeLabel'
import { FIT_LABEL } from '@/lib/fit'
import { formatCm, formatDate, formatDateTime, formatKg, formatNumber } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_COLOUR, type ProductColour } from '@/lib/productColour'
import type { PortalSource, PublicProduct, PublicStudent } from '../api'
import {
  canContinue,
  derivedSize,
  initialPicks,
  initialStep,
  missingColours,
  pickChanges,
  suggestionFor,
  type Picks,
} from '../choices'
import { usePortalStudent, useSaveChoices } from '../hooks'
import { productImage } from '../productImages'
import { SIZE_CHARTS } from '../sizeCharts'
import { ColourChip, ColourSelect } from './ColourSelect'
import { ProductImage } from './ProductImage'

type Step = 'identity' | 'help' | 'measure' | 'choose' | 'review' | 'overview'

type Success = { savedAt?: string; first: boolean }

export interface NotFoundCopy {
  title: string
  text: string
}

const LINK_NOT_FOUND: NotFoundCopy = {
  title: 'Liên kết không hợp lệ',
  text: 'Liên kết này không đúng hoặc đã hết hiệu lực.',
}

const studentDetail = (s: PublicStudent) => `Lớp ${s.class_name} · ${s.school_name}`

function Problem({ error, notFound, onRetry }: { error: unknown; notFound: NotFoundCopy; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 404) {
    return (
      <Panel flush>
        <PageTitle>{notFound.title}</PageTitle>
        <p>{notFound.text}</p>
        <ContactActions />
      </Panel>
    )
  }
  const text = requestErrorMessage(error, 'Có lỗi xảy ra, vui lòng thử lại.')
  return (
    <Panel flush>
      <div role="alert" className="flex flex-col gap-4">
        <PageTitle>Chưa tải được trang</PageTitle>
        <p>{text}</p>
        <Button size="lg" className={PARENT_BTN} onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    </Panel>
  )
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4 lg:py-3">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-navy sm:text-xl lg:text-2xl">{children}</dd>
    </div>
  )
}

function MeasurementsPanel({ s, onEdit }: { s: PublicStudent; onEdit?: () => void }) {
  return (
    <Panel
      title="Số đo"
      action={
        s.data_source === 'PARENT_DECLARED' ? (
          <span className="rounded-sm bg-secondary px-2 py-0.5 text-sm font-medium text-navy">Tự khai báo</span>
        ) : null
      }
      footer={
        onEdit ? (
          <Button variant="outline" size="lg" className="h-12 text-base" onClick={onEdit}>
            Sửa thông tin
          </Button>
        ) : null
      }
    >
      <dl className="grid grid-cols-3 gap-4 lg:-my-3 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-hairline">
        <StatRow label="Chiều cao">{formatCm(s.height_cm)}</StatRow>
        <StatRow label="Cân nặng">{formatKg(s.weight_kg)}</StatRow>
        <StatRow label={s.data_source === 'PARENT_DECLARED' ? 'Ngày khai' : 'Ngày đo'}>
          {formatDate(s.measured_at)}
        </StatRow>
      </dl>
    </Panel>
  )
}

function Identity({ s, onYes, onNo }: { s: PublicStudent; onYes: () => void; onNo: () => void }) {
  return (
    <>
      <PageHead title="Xác nhận học sinh" divider={false} />
      <StudentTag name={s.full_name} detail={studentDetail(s)} />
      <ActionBar>
        <Button variant="outline" size="lg" className={PARENT_ACTION} onClick={onNo}>
          Không đúng
        </Button>
        <Button size="lg" className={PARENT_ACTION_PRIMARY} onClick={onYes}>
          Đúng, tiếp tục
        </Button>
      </ActionBar>
    </>
  )
}

function Help({ onBack }: { onBack: () => void }) {
  return (
    <>
      <PageHead title="Liên hệ Giabaco để được hỗ trợ" divider={false} />
      <ContactActions />
      <Button variant="ghost" size="lg" className={PARENT_BTN} onClick={onBack}>
        Quay lại
      </Button>
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
      <PageHead title={s.full_name} meta={studentDetail(s)} aside={<Stepper current={1} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <MeasurementsPanel s={s} onEdit={onEdit} />
        {byProduct.length === 0 ? (
          <Panel title="Kết quả thử áo">
            <p className="text-muted-foreground">
              {s.data_source === 'PARENT_DECLARED'
                ? 'Chưa có kết quả thử áo.'
                : 'Chưa có lần thử áo nào được ghi nhận.'}
            </p>
          </Panel>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
            {byProduct.map(({ p, trials }) => (
              <Panel key={p.code} title={p.name}>
                <ul className="-my-1 flex flex-col divide-y divide-hairline">
                  {trials.map((t) => (
                    <li key={t.size_label} className="flex items-center justify-between gap-3 py-3">
                      <SizeLabel label={t.size_label} scale="lg" />
                      <span
                        className={cn(
                          'text-lg',
                          t.fit === 'FITS' ? 'font-semibold text-navy' : 'text-muted-foreground',
                        )}
                      >
                        {FIT_LABEL[t.fit]}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </div>
      <ActionBar>
        <Button size="lg" className={PARENT_ACTION_PRIMARY} onClick={onNext}>
          Tiếp tục
        </Button>
      </ActionBar>
    </>
  )
}

function SizeChartButton({ product, selected }: { product: PublicProduct; selected?: string }) {
  const chart = SIZE_CHARTS[product.code]
  if (!chart) return null
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 self-start px-3 text-[15px] md:px-4">
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
                <th
                  key={c.label}
                  scope="col"
                  className="px-1 pb-2 align-bottom text-sm font-semibold leading-tight text-navy"
                >
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

const OPTION_FOCUS =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

function Choose({
  s,
  picked,
  onBack,
  onNext,
}: {
  s: PublicStudent
  picked: Picks | null
  onBack: () => void
  onNext: (picks: Picks) => void
}) {
  const suggestions = useMemo(() => Object.fromEntries(s.products.map((p) => [p.code, suggestionFor(p, s)])), [s])
  const [picks, setPicks] = useState<Picks>(() => picked ?? initialPicks(s.products, s.choices, suggestions))
  const [colours, setColours] = useState<Record<string, ProductColour | null>>(() =>
    Object.fromEntries(s.products.map((p) => [p.code, picks[p.code]?.colour ?? null])),
  )
  const setSize = (code: string, size: string) =>
    setPicks((v) => ({
      ...v,
      [code]: { size_label: size, colour: colours[code] ?? null },
    }))
  const setColour = (code: string, colour: ProductColour) => {
    setColours((v) => ({ ...v, [code]: colour }))
    setPicks((v) => {
      const current = v[code]
      return current ? { ...v, [code]: { ...current, colour } } : v
    })
  }
  const [attempted, setAttempted] = useState(false)
  const unset = missingColours(s.products, picks)
  const ready = canContinue(s.products, picks, s.choices)
  const next = () => {
    if (unset.length > 0) {
      setAttempted(true)
      document.getElementsByName(`colour-${unset[0]}`)[0]?.focus()
      return
    }
    onNext(picks)
  }
  return (
    <>
      <PageHead title={s.full_name} meta={studentDetail(s)} aside={<Stepper current={2} />} />
      <div className="flex flex-col gap-6">
        {s.products.map((p) => {
          const suggestion = suggestions[p.code]
          const labelId = `prod-${p.code}`
          const colourId = `colour-label-${p.code}`
          const sizeId = `size-label-${p.code}`
          const pick = picks[p.code]
          const colour = colours[p.code] ?? null
          const preview = colour ?? DEFAULT_COLOUR
          const hasImage = productImage(p.code, s.gender, preview) !== null
          const colourMissing = attempted && unset.includes(p.code)
          return (
            <section
              key={p.code}
              aria-labelledby={labelId}
              className={cn(
                'grid gap-x-4 gap-y-5 rounded-lg border border-hairline bg-white p-4 md:p-5 lg:p-6',
                hasImage
                  ? 'grid-cols-[88px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:gap-x-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-x-8'
                  : 'grid-cols-1',
              )}
            >
              {hasImage ? (
                <ProductImage
                  product={p}
                  gender={s.gender}
                  colour={preview}
                  sizes="(min-width: 1024px) 300px, (min-width: 768px) 220px, 88px"
                  className="self-start md:row-span-2"
                />
              ) : null}
              <div className="flex min-w-0 flex-col justify-center gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
                <h2 id={labelId} className="text-xl font-semibold text-navy lg:text-2xl">
                  {p.name}
                </h2>
                <SizeChartButton product={p} selected={pick?.size_label} />
              </div>
              <div className={cn('flex min-w-0 flex-col gap-5', hasImage && 'col-span-2 md:col-span-1')}>
                <div className="flex flex-col gap-2 sm:max-w-[360px]">
                  <p id={colourId} className="text-[15px] font-medium text-muted-foreground">
                    Màu sắc
                  </p>
                  <ColourSelect
                    productCode={p.code}
                    labelledBy={`${labelId} ${colourId}`}
                    value={colour}
                    invalid={colourMissing}
                    onChange={(c) => setColour(p.code, c)}
                  />
                  {colourMissing ? (
                    <p role="alert" className="text-[15px] font-medium text-destructive">
                      Chọn màu
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <p id={sizeId} className="text-[15px] font-medium text-muted-foreground">
                    Cỡ
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby={`${labelId} ${sizeId}`}
                    className="grid grid-cols-[repeat(auto-fit,minmax(68px,1fr))] gap-2 pt-2"
                  >
                    {p.sizes.map((size) => {
                      const on = pick?.size_label === size
                      const badge = suggestion?.size === size ? suggestion : null
                      return (
                        <label
                          key={size}
                          className={cn(
                            'relative flex min-h-14 cursor-pointer items-center justify-center rounded-md border px-1 py-1 text-lg font-semibold',
                            OPTION_FOCUS,
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
                          {badge ? (
                            <>
                              {' '}
                              <span
                                className={cn(
                                  'absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-[18px]',
                                  on ? 'border-white bg-white text-navy' : 'border-navy/30 bg-secondary text-navy',
                                )}
                              >
                                {badge.source === 'trial' ? 'Thử vừa' : 'Gợi ý'}{' '}
                                <span className="sr-only">
                                  {badge.source === 'trial' ? 'theo nhân viên đo' : 'theo bảng cỡ'}
                                </span>
                              </span>
                            </>
                          ) : null}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <label
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 sm:w-fit sm:min-w-[300px]',
                    OPTION_FOCUS,
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
              </div>
            </section>
          )
        })}
      </div>
      <ActionBar>
        <Button variant="outline" size="lg" className={PARENT_ACTION} onClick={onBack}>
          Quay lại
        </Button>
        <Button size="lg" className={PARENT_ACTION_PRIMARY} disabled={!ready} onClick={next}>
          Tiếp tục
        </Button>
      </ActionBar>
    </>
  )
}

function ChoiceValue({ size, colour }: { size: string; colour: ProductColour | null }) {
  return (
    <span className="flex shrink-0 items-center gap-4">
      <ColourChip colour={colour} className="text-[15px]" />
      <SizeLabel label={size} scale="lg" className="px-4 py-2 text-xl" />
    </span>
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
      <PageHead title={s.full_name} meta={studentDetail(s)} aside={<Stepper current={3} />} />
      <ul className="grid gap-4 md:grid-cols-2 lg:gap-6">
        {s.products.map((p) => {
          const pick = picked[p.code]
          const colour = pick?.colour ?? null
          return (
            <li
              key={p.code}
              className={cn(
                'grid items-center gap-4 rounded-lg border p-4 lg:p-5',
                pick
                  ? 'grid-cols-[88px_minmax(0,1fr)] border-hairline bg-white lg:grid-cols-[132px_minmax(0,1fr)] lg:gap-6'
                  : 'border-dashed border-input bg-transparent',
              )}
            >
              {pick && colour ? (
                <ProductImage product={p} gender={s.gender} colour={colour} sizes="(min-width: 1024px) 132px, 88px" />
              ) : null}
              <div className="flex min-w-0 flex-col items-start gap-2">
                <h2 className={cn('text-lg font-semibold', pick ? 'text-navy' : 'text-muted-foreground')}>{p.name}</h2>
                {pick ? (
                  <>
                    <SizeLabel label={pick.size_label} scale="lg" className="px-4 py-2 text-xl" />
                    <ColourChip colour={colour} className="text-base" />
                  </>
                ) : (
                  <p className="text-muted-foreground">Không đăng ký</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {requestErrorMessage(error, 'Chưa lưu được lựa chọn. Vui lòng thử lại.')}
        </p>
      ) : null}
      <ActionBar>
        <Button variant="outline" size="lg" className={PARENT_ACTION} disabled={pending} onClick={onBack}>
          Quay lại sửa
        </Button>
        <Button size="lg" className={PARENT_ACTION_PRIMARY} disabled={pending} onClick={onConfirm}>
          {pending ? 'Đang lưu…' : 'Xác nhận đăng ký'}
        </Button>
      </ActionBar>
    </>
  )
}

function Overview({ s, onChange, onEdit }: { s: PublicStudent; onChange: () => void; onEdit?: () => void }) {
  const count = s.products.filter((p) => s.choices[p.code]).length
  return (
    <>
      <PageHead
        title={s.full_name}
        meta={studentDetail(s)}
        aside={<StatusPill done={count > 0}>{count > 0 ? 'Đã đăng ký' : 'Chưa đăng ký'}</StatusPill>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8">
        <Panel
          title="Cỡ đã chọn"
          footer={
            <Button size="lg" className="h-12 text-base sm:min-w-[200px]" onClick={onChange}>
              Đổi lựa chọn
            </Button>
          }
        >
          <ul className="-my-2 flex flex-col divide-y divide-hairline">
            {s.products.map((p) => {
              const choice = s.choices[p.code]
              const measured = derivedSize(p, s.trials)
              return (
                <li key={p.code} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 flex-col">
                    <span className={cn('text-lg font-semibold', choice ? 'text-navy' : 'text-muted-foreground')}>
                      {p.name}
                    </span>
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
        </Panel>
        <MeasurementsPanel s={s} onEdit={onEdit} />
      </div>
    </>
  )
}

function SuccessDialog({ success, onClose }: { success: Success | null; onClose: () => void }) {
  return (
    <Dialog open={success !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-w-[400px] gap-4 p-6 text-center"
      >
        <CheckCircle2 className="mx-auto size-14 text-navy" strokeWidth={1.5} aria-hidden="true" />
        <DialogTitle className="text-center text-2xl text-navy">
          {success?.first ? 'Đăng ký thành công' : 'Đã cập nhật lựa chọn'}
        </DialogTitle>
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
  actions?: ReactNode
}

export function PortalPage({
  source,
  skipIdentity = false,
  notFound = LINK_NOT_FOUND,
  onBack,
  onEdit,
  actions,
}: PortalPageProps) {
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
        <Skeleton className="h-10 w-2/3" />
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
        picked={picked}
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

  const intro = s ? step === 'identity' || step === 'help' : query.isError || !skipIdentity

  return (
    <ParentShell actions={actions} focusKey={step} width={intro ? 'narrow' : 'wide'} center={intro}>
      {onBack && !(s && intro) ? <BackLink label="Thông tin học sinh" onClick={onBack} /> : null}
      {body}
      <SuccessDialog success={success} onClose={() => setSuccess(null)} />
    </ParentShell>
  )
}
