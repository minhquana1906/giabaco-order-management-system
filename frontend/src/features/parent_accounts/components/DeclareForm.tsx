import { useState, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { Hotline, PARENT_BTN } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  childErrorMessage,
  fieldErrorsFromApi,
  HEIGHT_RANGE,
  toDeclaredBody,
  validateDeclared,
  WEIGHT_RANGE,
  type DeclaredErrors,
  type DeclaredValues,
} from '../addChildLogic'
import type { DeclaredBody, Gender } from '../api'
import { useParentClasses } from '../hooks'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
]

export const EMPTY_DECLARED: DeclaredValues = { class_id: '', gender: '', height: '', weight: '' }

interface DeclareFormProps {
  schoolId: string
  initial?: DeclaredValues
  submitLabel: string
  pendingLabel: string
  pending: boolean
  error: unknown
  onSubmit: (body: DeclaredBody) => void
  secondary?: { label: string; onClick: () => void }
}

export function DeclareForm({
  schoolId,
  initial = EMPTY_DECLARED,
  submitLabel,
  pendingLabel,
  pending,
  error,
  onSubmit,
  secondary,
}: DeclareFormProps) {
  const classes = useParentClasses(schoolId)
  const [values, setValues] = useState<DeclaredValues>(initial)
  const [clientErrors, setClientErrors] = useState<DeclaredErrors>({})

  const set = <K extends keyof DeclaredValues>(key: K, value: DeclaredValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setClientErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateDeclared(values)
    setClientErrors(errors)
    if (Object.values(errors).some(Boolean)) return
    onSubmit(toDeclaredBody(values))
  }

  const api = fieldErrorsFromApi(error)
  const errors: DeclaredErrors = {
    class_id: api.class_id,
    gender: api.gender,
    height: api.height_cm,
    weight: api.weight_kg,
    ...clientErrors,
  }
  const formError = childErrorMessage(error, 'Chưa lưu được thông tin. Vui lòng thử lại.')

  if (classes.isPending) {
    return (
      <div role="status" aria-label="Đang tải danh sách lớp" className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  if (classes.isError) {
    return (
      <div role="alert" className="flex flex-col gap-4">
        <p className="font-medium text-destructive">Chưa tải được danh sách lớp.</p>
        <Button size="lg" className={PARENT_BTN} onClick={() => void classes.refetch()}>
          Thử lại
        </Button>
        <Hotline />
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="class_id" label="Lớp" error={errors.class_id}>
        {(control) => (
          <Select value={values.class_id} onValueChange={(v) => set('class_id', v)}>
            <SelectTrigger {...control} className="h-12 w-full text-[17px]">
              <SelectValue placeholder="Chọn lớp của con" />
            </SelectTrigger>
            <SelectContent>
              {classes.data.map((c) => (
                <SelectItem key={c.id} value={c.id} className="min-h-11 text-base">
                  Lớp {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-2" aria-describedby={errors.gender ? 'gender-error' : undefined}>
        <legend className="mb-2 text-base font-medium leading-none">Giới tính</legend>
        <div className="grid grid-cols-2 gap-2">
          {GENDERS.map((g) => {
            const on = values.gender === g.value
            return (
              <label
                key={g.value}
                className={cn(
                  'flex min-h-[52px] cursor-pointer items-center justify-center rounded-md border px-3 text-lg font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  on ? 'border-2 border-navy bg-navy text-white' : 'border-input bg-card hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="gender"
                  className="sr-only"
                  value={g.value}
                  checked={on}
                  onChange={() => set('gender', g.value)}
                />
                {g.label}
              </label>
            )
          })}
        </div>
        {errors.gender ? (
          <p id="gender-error" role="alert" className="text-[15px] font-medium text-destructive">
            {errors.gender}
          </p>
        ) : null}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field id="height" label="Chiều cao (cm)" error={errors.height}>
          {(control) => (
            <Input
              {...control}
              name="height"
              inputMode="decimal"
              autoComplete="off"
              placeholder={`${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max}`}
              className="h-12 text-[17px]"
              value={values.height}
              onChange={(e) => set('height', e.target.value)}
            />
          )}
        </Field>
        <Field id="weight" label="Cân nặng (kg)" error={errors.weight}>
          {(control) => (
            <Input
              {...control}
              name="weight"
              inputMode="decimal"
              autoComplete="off"
              placeholder={`${WEIGHT_RANGE.min}–${WEIGHT_RANGE.max}`}
              className="h-12 text-[17px]"
              value={values.weight}
              onChange={(e) => set('weight', e.target.value)}
            />
          )}
        </Field>
      </div>
      {formError ? (
        <p role="alert" className="font-medium text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-3">
        <Button type="submit" size="lg" className={PARENT_BTN} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {secondary ? (
          <Button type="button" variant="outline" size="lg" className={PARENT_BTN} disabled={pending} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
