import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DobSelects } from '@/components/DobSelects'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { ContactActions, Hotline, LoadError, PARENT_BTN, PARENT_CONTROL, ParentHeading, ParentShell } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { dobFromIso, dobToIso } from '@/lib/dob'
import { focusFirstInvalid } from '@/lib/formFocus'
import { formatDate } from '@/lib/format'
import { requestErrorMessage } from '@/lib/requestError'
import {
  childErrorMessage,
  normalizeChildKey,
  outcomeAfterClaimError,
  outcomeAfterCreateError,
  stepAfterLookup,
  toCreateBody,
  validateChildKey,
  type AddChildStep,
  type ChildKeyErrors,
  type StepOutcome,
} from '../addChildLogic'
import type { ChildKey, DeclaredBody } from '../api'
import { useClaimChild, useCreateChild, useLookupChild, useParentSchools } from '../hooks'
import { AccountNav } from './AccountNav'
import { DeclareForm } from './DeclareForm'

const EMPTY_KEY: ChildKey = { school_id: '', full_name: '', dob: '' }

interface Match {
  full_name: string
  school_name: string
  class_name: string
}

function todayIso() {
  return new Date().toLocaleDateString('en-CA')
}

function SearchStep({
  value,
  notice,
  pending,
  error,
  onChange,
  onSubmit,
}: {
  value: ChildKey
  notice: string | null
  pending: boolean
  error: unknown
  onChange: (next: ChildKey) => void
  onSubmit: () => void
}) {
  const schools = useParentSchools()
  const [errors, setErrors] = useState<ChildKeyErrors>({})
  const [dob, setDob] = useState(() => dobFromIso(value.dob))
  const formRef = useRef<HTMLFormElement>(null)

  const set = (key: keyof ChildKey, next: string) => {
    onChange({ ...value, [key]: next })
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateChildKey(value, todayIso())
    setErrors(found)
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalid(formRef)
      return
    }
    onSubmit()
  }

  if (schools.isPending) {
    return (
      <div role="status" aria-label="Đang tải" className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  if (schools.isError) {
    return <LoadError message="Chưa tải được danh sách trường." onRetry={() => void schools.refetch()} />
  }
  if (schools.data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Chưa có trường nào để chọn.</p>
        <ContactActions />
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
      {notice ? (
        <p role="status" className="rounded-md border border-hairline bg-secondary px-4 py-3 text-[15px] text-navy">
          {notice}
        </p>
      ) : null}
      <Field id="school_id" label="Trường" error={errors.school_id}>
        {(control) => (
          <NativeSelect {...control} className={PARENT_CONTROL} value={value.school_id} onChange={(e) => set('school_id', e.target.value)}>
            <option value="">Chọn trường</option>
            {schools.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <div className="-mt-3">
        <Hotline lead="Bạn không tìm thấy trường?" />
      </div>
      <Field id="full_name" label="Họ và tên học sinh" error={errors.full_name}>
        {(control) => (
          <Input
            {...control}
            name="child-name"
            autoComplete="off"
            className={PARENT_CONTROL}
            value={value.full_name}
            onChange={(e) => set('full_name', e.target.value)}
          />
        )}
      </Field>
      <DobSelects
        value={dob}
        error={errors.dob}
        legendClassName="text-base"
        selectClassName={PARENT_CONTROL}
        onChange={(next) => {
          setDob(next)
          set('dob', dobToIso(next) ?? '')
        }}
      />
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {requestErrorMessage(error, 'Chưa tìm được hồ sơ. Vui lòng thử lại.')}
        </p>
      ) : null}
      <Button type="submit" size="lg" className={`${PARENT_BTN} mt-auto`} disabled={pending}>
        {pending ? 'Đang tìm…' : 'Tìm hồ sơ'}
      </Button>
    </form>
  )
}

function ConfirmStep({
  match,
  pending,
  error,
  onYes,
  onNo,
}: {
  match: Match
  pending: boolean
  error: unknown
  onYes: () => void
  onNo: () => void
}) {
  return (
    <>
      <ParentHeading title="Xác nhận học sinh" />
      <div className="relative rounded-lg bg-navy px-6 py-5 before:pointer-events-none before:absolute before:inset-[5px] before:rounded-md before:border before:border-dashed before:border-brass/60 before:content-['']">
        <p className="text-[26px] font-semibold leading-tight text-white">{match.full_name}</p>
        <p className="mt-1.5 text-[15px] text-sidebar-foreground">
          Lớp {match.class_name} · {match.school_name}
        </p>
      </div>
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {childErrorMessage(error, 'Chưa nhận được hồ sơ. Vui lòng thử lại.')}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-3">
        <Button size="lg" className={PARENT_BTN} disabled={pending} onClick={onYes}>
          {pending ? 'Đang xử lý…' : 'Đúng, nhận hồ sơ này'}
        </Button>
        <Button variant="outline" size="lg" className={PARENT_BTN} disabled={pending} onClick={onNo}>
          Không đúng
        </Button>
      </div>
    </>
  )
}

function ContactStep({ onBack }: { onBack: () => void }) {
  return (
    <>
      <ParentHeading title="Vui lòng liên hệ Giabaco">Có nhiều hồ sơ trùng với thông tin này.</ParentHeading>
      <div className="mt-auto flex flex-col gap-3">
        <ContactActions />
        <Button variant="ghost" size="lg" className={PARENT_BTN} onClick={onBack}>
          Quay lại
        </Button>
      </div>
    </>
  )
}

export function AddChild() {
  const navigate = useNavigate()
  const lookup = useLookupChild()
  const claim = useClaimChild()
  const create = useCreateChild()
  const [step, setStep] = useState<AddChildStep>('search')
  const [key, setKey] = useState<ChildKey>(EMPTY_KEY)
  const [match, setMatch] = useState<Match | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const applyOutcome = (outcome: StepOutcome) => {
    claim.reset()
    create.reset()
    setNotice(outcome.notice)
    setStep(outcome.step)
  }

  const goBackToSearch = (notice: string | null = null) => {
    lookup.reset()
    applyOutcome({ step: 'search', notice })
  }

  const openChild = (studentId: string) =>
    void navigate({ to: '/parent/children/$studentId', params: { studentId } })

  const search = () => {
    const normalized = normalizeChildKey(key)
    setKey(normalized)
    setNotice(null)
    claim.reset()
    create.reset()
    lookup.mutate(normalized, {
      onSuccess: (result) => {
        setMatch(result.found && !result.ambiguous ? result : null)
        setStep(stepAfterLookup(result))
      },
    })
  }

  const confirm = () =>
    claim.mutate(key, {
      onSuccess: (child) => openChild(child.student_id),
      onError: (error) => {
        const outcome = outcomeAfterClaimError(error)
        if (outcome) applyOutcome(outcome)
      },
    })

  const declare = (declared: DeclaredBody) =>
    create.mutate(toCreateBody(key, declared), {
      onSuccess: (child) => openChild(child.student_id),
      onError: (error) => {
        const outcome = outcomeAfterCreateError(error)
        if (outcome) applyOutcome(outcome)
      },
    })

  let body
  if (step === 'confirm' && match) {
    body = (
      <ConfirmStep
        match={match}
        pending={claim.isPending}
        error={claim.error}
        onYes={confirm}
        onNo={() => goBackToSearch()}
      />
    )
  } else if (step === 'contact') {
    body = <ContactStep onBack={() => goBackToSearch()} />
  } else if (step === 'declare') {
    body = (
      <>
        <ParentHeading title="Chưa có hồ sơ" />
        <dl className="rounded-lg border border-hairline bg-white px-5 py-3">
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-muted-foreground">Họ và tên</dt>
            <dd className="text-right font-medium">{key.full_name}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-muted-foreground">Ngày sinh</dt>
            <dd className="text-right font-medium tabular-nums">{formatDate(key.dob)}</dd>
          </div>
        </dl>
        <DeclareForm
          schoolId={key.school_id}
          submitLabel="Tạo hồ sơ và chọn cỡ"
          pendingLabel="Đang tạo hồ sơ…"
          pending={create.isPending}
          error={create.error}
          onSubmit={declare}
          secondary={{ label: 'Sửa thông tin vừa nhập', onClick: () => goBackToSearch() }}
        />
      </>
    )
  } else {
    body = (
      <>
        <ParentHeading title="Thêm hồ sơ mới" />
        <SearchStep value={key} notice={notice} pending={lookup.isPending} error={lookup.error} onChange={setKey} onSubmit={search} />
      </>
    )
  }

  return (
    <ParentShell
      actions={<AccountNav />}
      onBack={() => void navigate({ to: '/parent' })}
      focusKey={step}
      width={step === 'declare' ? 'md' : 'sm'}
      panel={step !== 'declare'}
    >
      {body}
    </ParentShell>
  )
}
