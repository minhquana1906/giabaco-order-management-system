import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
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
import { formatCm, formatDate, formatDateTime, formatKg } from '@/lib/format'
import { ApiError, GENERIC_ERROR_MESSAGE } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Ordering, PortalSource, PublicStudent } from '../api'
import {
  buildPayload,
  estimateTotal,
  hasSplitLines,
  initialDraft,
  initialStep,
  orderingMode,
  type Draft,
} from '../choices'
import { useOrdering, usePortalStudent, useSaveOrder } from '../hooks'
import { ChooseStep } from './ChooseStep'
import { OrderSummary } from './OrderSummary'
type Step = 'identity' | 'help' | 'measure' | 'choose' | 'review' | 'overview'

type Success = { savedAt?: string; first: boolean }

export interface NotFoundCopy {
  title: string
  text: string
}

const LINK_NOT_FOUND: NotFoundCopy = {
  title: 'Liên kết không hợp lệ',
  text: 'Liên kết này không đúng hoặc đã hết hạn. Hỏi Giabaco để nhận liên kết mới.',
}

const SPLIT_NOTE = 'Đơn có nhiều cỡ cho cùng một sản phẩm. Để đổi, vui lòng liên hệ Giabaco.'

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
  const text = requestErrorMessage(error, GENERIC_ERROR_MESSAGE)
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
      <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-3 lg:-my-3 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-hairline">
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

function Measurements({
  s,
  onNext,
  onEdit,
  notice,
}: {
  s: PublicStudent
  onNext?: () => void
  onEdit?: () => void
  notice?: ReactNode
}) {
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6">
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
      {notice}
      {onNext ? (
        <ActionBar>
          <Button size="lg" className={PARENT_ACTION_PRIMARY} onClick={onNext}>
            Tiếp tục
          </Button>
        </ActionBar>
      ) : null}
    </>
  )
}

const NO_CAMPAIGN = 'Trường chưa mở đăng ký đồng phục'
const CAMPAIGN_LOCKED = 'Đợt đăng ký đồng phục đã đóng'

function ClosedNotice({ mode }: { mode: 'none' | 'locked' }) {
  return (
    <Panel flush>
      <div role="status" className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-navy">{mode === 'none' ? NO_CAMPAIGN : CAMPAIGN_LOCKED}</h2>
        <p className="text-muted-foreground">Giabaco sẽ thông báo khi nhà trường mở đợt đăng ký.</p>
      </div>
    </Panel>
  )
}

function Review({
  s,
  ordering,
  draft,
  pending,
  error,
  onBack,
  onConfirm,
}: {
  s: PublicStudent
  ordering: Ordering
  draft: Draft
  pending: boolean
  error: unknown
  onBack: () => void
  onConfirm: () => void
}) {
  const [checked, setChecked] = useState(false)
  const lines = buildPayload(ordering, draft)
  const { total, hasUnpriced } = estimateTotal(ordering, lines)
  return (
    <>
      <PageHead title={s.full_name} meta={studentDetail(s)} aside={<Stepper current={3} />} />
      <OrderSummary ordering={ordering} lines={lines} total={total} hasUnpriced={hasUnpriced} />
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-medium text-navy">
        <input
          type="checkbox"
          className="size-5 accent-[var(--navy)]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        Tôi đã kiểm tra thông tin
      </label>
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {error instanceof ApiError && error.code === 'campaign_locked'
            ? 'Đợt đăng ký đã đóng nên không gửi được đơn. Nếu cần thay đổi, vui lòng liên hệ Giabaco.'
            : requestErrorMessage(error, 'Chưa gửi được đăng ký. Vui lòng thử lại sau ít phút.')}
        </p>
      ) : null}
      <ActionBar>
        <Button variant="outline" size="lg" className={PARENT_ACTION} disabled={pending} onClick={onBack}>
          Quay lại sửa
        </Button>
        <Button
          size="lg"
          className={PARENT_ACTION_PRIMARY}
          disabled={pending || !checked}
          onClick={onConfirm}
        >
          {pending ? 'Đang gửi…' : 'Gửi đăng ký'}
        </Button>
      </ActionBar>
    </>
  )
}

function Overview({
  s,
  ordering,
  onChange,
  onEdit,
}: {
  s: PublicStudent
  ordering: Ordering
  onChange: () => void
  onEdit?: () => void
}) {
  const mode = orderingMode(ordering)
  const order = ordering.order
  const split = order !== null && hasSplitLines(order)
  return (
    <>
      <PageHead
        title={s.full_name}
        meta={studentDetail(s)}
        aside={<StatusPill done={order !== null}>{order ? 'Đã đăng ký' : 'Chưa đăng ký'}</StatusPill>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          {mode !== 'open' ? (
            <ClosedNotice mode={mode === 'none' ? 'none' : 'locked'} />
          ) : null}
          {order ? (
            <Panel
              title="Đơn đã gửi"
              footer={
                mode !== 'open' ? null : split ? (
                  <p className="text-[15px] text-muted-foreground">{SPLIT_NOTE}</p>
                ) : (
                  <Button size="lg" className="h-12 text-base sm:min-w-[200px]" onClick={onChange}>
                    Đổi lựa chọn
                  </Button>
                )
              }
            >
              <OrderSummary ordering={ordering} lines={order} total={order.total} hasUnpriced={order.has_unpriced} />
            </Panel>
          ) : null}
        </div>
        <MeasurementsPanel s={s} onEdit={mode === 'open' ? onEdit : undefined} />
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
          {success?.first ? 'Đăng ký thành công' : 'Đã cập nhật đăng ký'}
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
  const orderingQuery = useOrdering(source)
  const save = useSaveOrder(source)
  const [stepState, setStep] = useState<Step | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [success, setSuccess] = useState<Success | null>(null)

  useEffect(() => {
    document.title = 'Đăng ký đồng phục · G-UNIFORM'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  const s = query.data
  const ordering = orderingQuery.data
  const step = stepState ?? (ordering ? initialStep(ordering.order !== null, skipIdentity) : 'identity')
  const editDeclared = s?.data_source === 'PARENT_DECLARED' ? onEdit : undefined
  const mode = ordering ? orderingMode(ordering) : 'none'

  const submit = () => {
    if (!ordering || !draft) return
    const first = ordering.order === null
    save.mutate(buildPayload(ordering, draft), {
      onSuccess: (saved) => {
        setDraft(null)
        setStep('overview')
        setSuccess({ savedAt: saved.order?.submitted_at ?? undefined, first })
      },
    })
  }

  const edit = () => {
    setDraft(null)
    setStep('choose')
  }

  let body: ReactNode
  if (query.isPending || orderingQuery.isPending) {
    body = (
      <div role="status" aria-label="Đang tải" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[52px] w-full" />
      </div>
    )
  } else if (query.isError || orderingQuery.isError || !s || !ordering) {
    body = (
      <Problem
        error={query.error ?? orderingQuery.error}
        notFound={notFound}
        onRetry={() => {
          void query.refetch()
          void orderingQuery.refetch()
        }}
      />
    )
  } else if (step === 'help') {
    body = <Help onBack={() => setStep('identity')} />
  } else if (step === 'identity') {
    body = <Identity s={s} onYes={() => setStep('measure')} onNo={() => setStep('help')} />
  } else if (step === 'measure') {
    body = (
      <Measurements
        s={s}
        onNext={mode === 'open' ? () => setStep('choose') : undefined}
        onEdit={editDeclared}
        notice={mode === 'open' ? null : <ClosedNotice mode={mode === 'none' ? 'none' : 'locked'} />}
      />
    )
  } else if (step === 'choose' && mode === 'open') {
    body = (
      <ChooseStep
        s={s}
        ordering={ordering}
        draft={draft ?? initialDraft(ordering, s)}
        onDraft={setDraft}
        onBack={() => setStep(ordering.order ? 'overview' : 'measure')}
        onNext={() => {
          save.reset()
          setDraft((d) => d ?? initialDraft(ordering, s))
          setStep('review')
        }}
      />
    )
  } else if (step === 'review' && draft && mode === 'open') {
    body = (
      <Review
        s={s}
        ordering={ordering}
        draft={draft}
        pending={save.isPending}
        error={save.error}
        onBack={() => setStep('choose')}
        onConfirm={submit}
      />
    )
  } else {
    body = <Overview s={s} ordering={ordering} onChange={edit} onEdit={editDeclared} />
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
