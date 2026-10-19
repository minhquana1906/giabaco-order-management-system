import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Field } from '@/components/Field'
import { ContactActions, Hotline, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { requestErrorMessage } from '@/lib/requestError'
import {
  normalizeChildKey,
  outcomeAfterClaimError,
  outcomeAfterCreateError,
  stepAfterLookup,
  toCreateBody,
  validateChildKey,
  type AddChildStep,
  type ChildKeyErrors,
} from '../addChildLogic'
import type { ChildKey, DeclaredBody } from '../api'
import { useClaimChild, useCreateChild, useLookupChild, useParentSchools } from '../hooks'
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

  const set = (key: keyof ChildKey, next: string) => {
    onChange({ ...value, [key]: next })
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateChildKey(value, todayIso())
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
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
    return (
      <div role="alert" className="flex flex-col gap-4">
        <p className="font-medium text-destructive">Chưa tải được danh sách trường.</p>
        <Button size="lg" className={PARENT_BTN} onClick={() => void schools.refetch()}>
          Thử lại
        </Button>
        <Hotline />
      </div>
    )
  }
  if (schools.data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Chưa có trường nào để chọn. Vui lòng liên hệ Giabaco để được hỗ trợ.</p>
        <ContactActions />
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {notice ? (
        <p role="status" className="rounded-md border border-hairline bg-secondary px-4 py-3 text-[15px] text-navy">
          {notice}
        </p>
      ) : null}
      <Field id="school_id" label="Trường" error={errors.school_id}>
        {(control) => (
          <Select value={value.school_id} onValueChange={(v) => set('school_id', v)}>
            <SelectTrigger {...control} className="h-12 w-full text-[17px]">
              <SelectValue placeholder="Chọn trường của con" />
            </SelectTrigger>
            <SelectContent>
              {schools.data.map((s) => (
                <SelectItem key={s.id} value={s.id} className="min-h-11 text-base">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <p className="-mt-3 text-[15px] text-muted-foreground">
        Không thấy trường của con? Liên hệ Giabaco:{' '}
        <a className="inline-flex min-h-11 items-center font-semibold text-navy underline" href="tel:0835352004">
          0835352004
        </a>
      </p>
      <Field id="full_name" label="Họ và tên của con" error={errors.full_name}>
        {(control) => (
          <Input
            {...control}
            name="child-name"
            autoComplete="off"
            className="h-12 text-[17px]"
            value={value.full_name}
            onChange={(e) => set('full_name', e.target.value)}
          />
        )}
      </Field>
      <Field id="dob" label="Ngày sinh của con" error={errors.dob}>
        {(control) => (
          <Input
            {...control}
            name="child-dob"
            type="date"
            max={todayIso()}
            className="h-12 text-[17px]"
            value={value.dob}
            onChange={(e) => set('dob', e.target.value)}
          />
        )}
      </Field>
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
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-navy">Đúng con của bạn?</h1>
        <p className="text-balance text-muted-foreground">Chúng tôi tìm thấy một hồ sơ khớp với thông tin bạn nhập.</p>
      </div>
      <div className="relative rounded-lg bg-navy px-6 py-5 before:pointer-events-none before:absolute before:inset-[5px] before:rounded-md before:border before:border-dashed before:border-brass/60 before:content-['']">
        <p className="text-[26px] font-semibold leading-tight text-white">{match.full_name}</p>
        <p className="mt-1.5 text-[15px] text-sidebar-foreground">
          Lớp {match.class_name} · {match.school_name}
        </p>
      </div>
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {requestErrorMessage(error, 'Chưa nhận được hồ sơ. Vui lòng thử lại.')}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-3">
        <Button size="lg" className={PARENT_BTN} disabled={pending} onClick={onYes}>
          {pending ? 'Đang xử lý…' : 'Đúng, nhận hồ sơ này'}
        </Button>
        <Button variant="outline" size="lg" className={PARENT_BTN} disabled={pending} onClick={onNo}>
          Không phải con tôi
        </Button>
      </div>
    </>
  )
}

function ContactStep({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-navy">Vui lòng liên hệ Giabaco</h1>
        <p className="text-balance text-muted-foreground">
          Có nhiều hồ sơ trùng với thông tin này nên chúng tôi cần kiểm tra giúp bạn.
        </p>
      </div>
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

  const goBackToSearch = (next: string | null = null) => {
    lookup.reset()
    claim.reset()
    create.reset()
    setNotice(next)
    setStep('search')
  }

  const openChild = (studentId: string) =>
    void navigate({ to: '/parent/children/$studentId', params: { studentId } })

  const search = () => {
    const normalized = normalizeChildKey(key)
    setKey(normalized)
    setNotice(null)
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
        if (outcome) {
          setNotice(outcome.notice)
          setStep(outcome.step)
        }
      },
    })

  const declare = (declared: DeclaredBody) =>
    create.mutate(toCreateBody(key, declared), {
      onSuccess: (child) => openChild(child.student_id),
      onError: (error) => {
        const outcome = outcomeAfterCreateError(error)
        if (outcome) {
          setNotice(outcome.notice)
          setStep(outcome.step)
        }
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
        onNo={() => goBackToSearch('Hãy kiểm tra lại họ tên, ngày sinh và trường rồi tìm lại. Nếu vẫn chưa đúng, liên hệ Giabaco.')}
      />
    )
  } else if (step === 'contact') {
    body = <ContactStep onBack={() => goBackToSearch()} />
  } else if (step === 'declare') {
    body = (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-navy">Chưa thấy hồ sơ của con</h1>
          <p className="text-balance text-muted-foreground">Bạn nhập thông tin của con để chọn cỡ áo.</p>
        </div>
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
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-navy">Thêm con</h1>
          <p className="text-balance text-muted-foreground">
            Nhập thông tin của con để tìm hồ sơ đã có hoặc tạo hồ sơ mới.
          </p>
        </div>
        <SearchStep value={key} notice={notice} pending={lookup.isPending} error={lookup.error} onChange={setKey} onSubmit={search} />
      </>
    )
  }

  return (
    <ParentShell onBack={() => void navigate({ to: '/parent' })}>
      {body}
    </ParentShell>
  )
}
