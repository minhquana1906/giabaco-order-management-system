import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Field } from '@/components/Field'
import { GenderToggle } from '@/components/GenderToggle'
import { NativeSelect } from '@/components/NativeSelect'
import { UnitInput } from '@/components/UnitInput'
import { ActionBar, Panel } from '@/components/ParentPage'
import { LoadError, PARENT_ACTION, PARENT_ACTION_PRIMARY, PARENT_CONTROL } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { focusFirstInvalid } from '@/lib/formFocus'
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

const EMPTY_DECLARED: DeclaredValues = {
  class_id: '',
  gender: '',
  height: '',
  weight: '',
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
  summary?: ReactNode
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
  summary,
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
      focusFirstInvalid(formRef)
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
    return <LoadError message="Chưa tải được danh sách lớp." onRetry={() => void classes.refetch()} />
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6 lg:gap-8">
      <div className="lg:max-w-[560px]">
        <Panel title="Học sinh">
          {summary}
          <Field id="class_id" label="Lớp" error={errors.class_id}>
            {(control) => (
              <NativeSelect
                {...control}
                className={PARENT_CONTROL}
                value={values.class_id}
                onChange={(e) => set('class_id', e.target.value)}
              >
                <option value="">Chọn lớp</option>
                {classes.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
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
                  className={PARENT_CONTROL}
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
                  className={PARENT_CONTROL}
                  value={values.weight}
                  onChange={(e) => set('weight', e.target.value)}
                />
              )}
            </Field>
          </div>
        </Panel>
      </div>
      {formError ? (
        <p role="alert" className="font-medium text-destructive">
          {formError}
        </p>
      ) : null}
      <ActionBar stack>
        {secondary ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={PARENT_ACTION}
            disabled={pending}
            onClick={secondary.onClick}
          >
            {secondary.label}
          </Button>
        ) : null}
        <Button type="submit" size="lg" className={PARENT_ACTION_PRIMARY} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </ActionBar>
    </form>
  )
}
