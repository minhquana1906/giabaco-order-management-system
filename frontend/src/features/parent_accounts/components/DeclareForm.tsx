import { useRef, useState, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { FormSection } from '@/components/FormSection'
import { GenderToggle } from '@/components/GenderToggle'
import { NativeSelect } from '@/components/NativeSelect'
import { UnitInput } from '@/components/UnitInput'
import { Hotline, PARENT_BTN } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { DeclaredBody } from '../api'
import { useParentClasses } from '../hooks'

const CONTROL = 'h-12 text-[17px]'

export const EMPTY_DECLARED: DeclaredValues = {
  class_id: '',
  gender: '',
  height: '',
  weight: '',
  parent_phone: '',
  parent_name: '',
  parent_email: '',
}

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
  const formRef = useRef<HTMLFormElement>(null)

  const set = <K extends keyof DeclaredValues>(key: K, value: DeclaredValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setClientErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateDeclared(values)
    setClientErrors(errors)
    if (Object.values(errors).some(Boolean)) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    onSubmit(toDeclaredBody(values))
  }

  const api = fieldErrorsFromApi(error)
  const errors: DeclaredErrors = {
    class_id: api.class_id,
    gender: api.gender,
    height: api.height_cm,
    weight: api.weight_kg,
    parent_phone: api.parent_phone,
    parent_name: api.parent_name,
    parent_email: api.parent_email,
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
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="class_id" label="Lớp" error={errors.class_id}>
        {(control) => (
          <NativeSelect {...control} className={CONTROL} value={values.class_id} onChange={(e) => set('class_id', e.target.value)}>
            <option value="">Chọn lớp của con</option>
            {classes.data.map((c) => (
              <option key={c.id} value={c.id}>
                Lớp {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <FormSection title="Học sinh">
        <GenderToggle
          value={values.gender}
          error={errors.gender}
          legendClassName="text-base"
          optionClassName="min-h-[52px] text-lg font-semibold"
          onChange={(g) => set('gender', g)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field id="height" label="Chiều cao (cm)" error={errors.height}>
            {(control) => (
              <UnitInput
                {...control}
                name="height"
                unit="cm"
                placeholder={`${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max}`}
                className={CONTROL}
                value={values.height}
                onChange={(e) => set('height', e.target.value)}
              />
            )}
          </Field>
          <Field id="weight" label="Cân nặng (kg)" error={errors.weight}>
            {(control) => (
              <UnitInput
                {...control}
                name="weight"
                unit="kg"
                placeholder={`${WEIGHT_RANGE.min}–${WEIGHT_RANGE.max}`}
                className={CONTROL}
                value={values.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            )}
          </Field>
        </div>
      </FormSection>
      <FormSection title="Phụ huynh">
        <Field
          id="parent_phone"
          label="Số điện thoại phụ huynh"
          hint="Có thể nhập +84; hệ thống tự chuẩn hóa về dạng 0xxxxxxxxx."
          error={errors.parent_phone}
        >
          {(control) => (
            <Input
              {...control}
              name="tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={CONTROL}
              value={values.parent_phone}
              onChange={(e) => set('parent_phone', e.target.value)}
            />
          )}
        </Field>
        <Field id="parent_name" label="Họ tên phụ huynh (không bắt buộc)" error={errors.parent_name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              autoComplete="name"
              className={CONTROL}
              value={values.parent_name}
              onChange={(e) => set('parent_name', e.target.value)}
            />
          )}
        </Field>
        <Field id="parent_email" label="Email (không bắt buộc)" error={errors.parent_email}>
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className={CONTROL}
              value={values.parent_email}
              onChange={(e) => set('parent_email', e.target.value)}
            />
          )}
        </Field>
      </FormSection>
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
