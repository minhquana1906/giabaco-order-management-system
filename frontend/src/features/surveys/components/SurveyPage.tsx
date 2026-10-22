import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { DobSelects } from '@/components/DobSelects'
import { Field } from '@/components/Field'
import { GenderToggle } from '@/components/GenderToggle'
import { ActionBar, PageTitle, Panel } from '@/components/ParentPage'
import { PARENT_ACTION_PRIMARY, PARENT_BTN, PARENT_CONTROL, ParentShell } from '@/components/ParentShell'
import { UnitInput } from '@/components/UnitInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { focusFirstInvalid } from '@/lib/formFocus'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'
import { NativeSelect } from '@/components/NativeSelect'
import { surveyApi } from '../api'
import { PROVINCES } from '../units'
import {
  BODY_TRAITS,
  emptySurvey,
  FIT_PREFERENCES,
  isoDaysBefore,
  loadDraft,
  MAX_MEASUREMENT_AGE_DAYS,
  MEASURE_METHODS,
  measurementWarnings,
  PAST_ISSUES,
  SUPPLY_OPTIONS,
  saveDraft,
  surveyErrorsFromApi,
  toSurveyBody,
  validateSurvey,
  type SurveyErrors,
  type SurveyValues,
} from '../logic'

const todayIso = () => new Date().toLocaleDateString('en-CA')

const HOW_TO_MEASURE: [string, string][] = [
  ['Chiều cao', 'đứng sát tường, bỏ dép, đặt thước kẻ ngang đỉnh đầu, đánh dấu rồi đo.'],
  ['Cân nặng', 'cân buổi sáng, mặc quần áo mỏng.'],
  ['Vòng ngực', 'qua chỗ nở nhất của ngực, ngay dưới nách.'],
  ['Vòng eo', 'ngang rốn, con không hóp bụng.'],
  ['Vòng mông', 'qua chỗ nở nhất của mông, hai chân khép.'],
]

const MEASURE_TIPS = [
  'Dùng thước dây may mặc, con mặc áo mỏng, đứng thẳng, thở bình thường.',
  'Thước dây nằm ngang, áp sát người nhưng không siết.',
  'Đọc số theo cm. Không chắc thì đo 2 lần và lấy số trung bình.',
]

interface ChoiceProps<T extends string> {
  name: string
  legend: string
  type: 'radio' | 'checkbox'
  options: { value: T; label: string; hint?: string }[]
  selected: readonly T[]
  onToggle: (value: T) => void
  error?: string
}

function Choice<T extends string>({ name, legend, type, options, selected, onToggle, error }: ChoiceProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 text-base font-medium">{legend}</legend>
      {options.map((o) => {
        const checked = selected.includes(o.value)
        return (
          <label
            key={o.value}
            className={cn(
              'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-md border px-4 py-3',
              checked ? 'border-navy bg-navy/5' : 'border-input bg-white',
            )}
          >
            <input
              type={type}
              name={name}
              className="mt-1 size-5 shrink-0 accent-navy"
              checked={checked}
              aria-invalid={error ? true : undefined}
              onChange={() => onToggle(o.value)}
            />
            <span>
              <span className="block">{o.label}</span>
              {o.hint ? <span className="block text-[15px] text-muted-foreground">{o.hint}</span> : null}
            </span>
          </label>
        )
      })}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-[15px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="-mt-1 text-[15px] text-muted-foreground">{children}</p>
}

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export function SurveyPage() {
  const [today] = useState(todayIso)
  const [values, setValues] = useState<SurveyValues>(() => loadDraft(today))
  const [clientErrors, setClientErrors] = useState<SurveyErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const submit = useMutation({
    mutationFn: surveyApi.submit,
    onSuccess: () => saveDraft(null),
  })

  useEffect(() => {
    if (!submit.isSuccess) saveDraft(values)
  }, [values, submit.isSuccess])

  const set = <K extends keyof SurveyValues>(key: K, value: SurveyValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setClientErrors((e) => ({ ...e, [key]: undefined }))
  }

  if (submit.isSuccess) {
    return (
      <ParentShell width="narrow" center focusKey="done">
        <PageTitle>Cảm ơn quý phụ huynh!</PageTitle>
        <p>Giabaco đã nhận thông tin của học sinh {submit.variables.child_full_name}.</p>
        <Button
          size="lg"
          className={PARENT_BTN}
          onClick={() => {
            setValues({ ...emptySurvey(today), parent_phone: values.parent_phone })
            submit.reset()
          }}
        >
          Gửi phiếu cho học sinh khác
        </Button>
      </ParentShell>
    )
  }

  const apiError = submit.error instanceof ApiError ? submit.error : null
  const errors: SurveyErrors = { ...surveyErrorsFromApi(apiError?.status === 422 ? apiError.fields : undefined), ...clientErrors }
  const warnings = measurementWarnings(values)
  const formError =
    submit.error && !(apiError?.status === 422 && apiError.fields)
      ? (apiError?.message ?? 'Chưa gửi được phiếu. Vui lòng thử lại.')
      : null

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateSurvey(values, today)
    setClientErrors(found)
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalid(formRef)
      return
    }
    submit.mutate(toSurveyBody(values))
  }

  const wards = PROVINCES.find((p) => p.name === values.province)?.wards ?? []

  const measure = (
    key: 'height' | 'weight' | 'chest' | 'waist' | 'hip',
    label: string,
    unit: string,
    className?: string,
  ) => (
    <Field id={key} label={label} error={errors[key]} className={className}>
      {(control) => (
        <UnitInput
          {...control}
          name={key}
          unit={unit}
          className={PARENT_CONTROL}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  )

  return (
    <ParentShell width="form">
      <PageTitle>Phiếu khảo sát số đo học sinh</PageTitle>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <Panel title="1. Thông tin học sinh">
          <Field id="school_name" label="Tên trường" error={errors.school_name}>
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                placeholder="Trường Tiểu học Lê Quý Đôn"
                className={PARENT_CONTROL}
                value={values.school_name}
                onChange={(e) => set('school_name', e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="province" label="Tỉnh/Thành phố" error={errors.province}>
              {(control) => (
                <NativeSelect
                  {...control}
                  className={PARENT_CONTROL}
                  value={values.province}
                  onChange={(e) => {
                    set('province', e.target.value)
                    set('ward', '')
                  }}
                >
                  <option value="">Chọn tỉnh/thành phố</option>
                  {PROVINCES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id="ward" label="Phường/Xã" error={errors.ward}>
              {(control) => (
                <NativeSelect
                  {...control}
                  className={PARENT_CONTROL}
                  value={values.ward}
                  disabled={!values.province}
                  onChange={(e) => set('ward', e.target.value)}
                >
                  <option value="">{values.province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố trước'}</option>
                  {wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field id="child_full_name" label="Họ và tên học sinh" error={errors.child_full_name}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  className={PARENT_CONTROL}
                  value={values.child_full_name}
                  onChange={(e) => set('child_full_name', e.target.value)}
                />
              )}
            </Field>
            <Field id="class_name" label="Lớp" error={errors.class_name}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  placeholder="Ví dụ 3A1"
                  className={PARENT_CONTROL}
                  value={values.class_name}
                  onChange={(e) => set('class_name', e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <DobSelects
              value={values.dob}
              error={errors.dob}
              legendClassName="text-base"
              selectClassName={PARENT_CONTROL}
              onChange={(dob) => set('dob', dob)}
            />
            <GenderToggle
              value={values.gender}
              error={errors.gender}
              legendClassName="text-base"
              optionClassName="min-h-[52px] text-lg font-semibold"
              onChange={(g) => set('gender', g)}
            />
          </div>
          <Field id="parent_phone" label="Số điện thoại Zalo của Cha/Mẹ" error={errors.parent_phone}>
            {(control) => (
              <>
                <Hint>Để Giabaco gửi mã đơn hàng.</Hint>
                <Input
                  {...control}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={PARENT_CONTROL}
                  value={values.parent_phone}
                  onChange={(e) => set('parent_phone', e.target.value)}
                />
              </>
            )}
          </Field>
        </Panel>

        <Panel title="2. Số đo của học sinh">
          <details className="rounded-md border border-hairline bg-muted/40 px-4 py-3">
            <summary className="cursor-pointer font-medium text-navy">Cách đo chuẩn</summary>
            <dl className="mt-3 grid gap-x-3 gap-y-1.5 text-[15px] sm:grid-cols-[auto_minmax(0,1fr)]">
              {HOW_TO_MEASURE.map(([term, how]) => (
                <div key={term} className="contents">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-muted-foreground max-sm:mb-1">{how}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 list-disc border-t border-hairline pt-3 pl-5 text-[15px] text-muted-foreground">
              {MEASURE_TIPS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
          <Choice
            name="measure_method"
            legend="Số đo dưới đây lấy từ đâu?"
            type="radio"
            options={MEASURE_METHODS}
            selected={values.measure_method ? [values.measure_method] : []}
            onToggle={(v) => set('measure_method', v)}
            error={errors.measure_method}
          />
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-5 sm:grid-cols-3">
            <Field id="measured_on" label="Ngày đo" error={errors.measured_on} className="col-span-2 sm:col-span-1">
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  min={isoDaysBefore(today, MAX_MEASUREMENT_AGE_DAYS)}
                  max={today}
                  className={PARENT_CONTROL}
                  value={values.measured_on}
                  onChange={(e) => set('measured_on', e.target.value)}
                />
              )}
            </Field>
            {measure('height', 'Chiều cao', 'cm')}
            {measure('weight', 'Cân nặng', 'kg')}
          </div>
          <div
            role="group"
            aria-labelledby="girths-title"
            className="flex flex-col gap-3 border-t border-hairline pt-5"
          >
            <p id="girths-title" className="text-base font-semibold text-navy">
              Ba vòng đo <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
            </p>
            <div className="grid grid-cols-3 items-start gap-x-3 gap-y-5 sm:gap-x-4">
              {measure('chest', 'Vòng ngực', 'cm')}
              {measure('waist', 'Vòng eo', 'cm')}
              {measure('hip', 'Vòng mông', 'cm')}
            </div>
          </div>
          {warnings.length ? (
            <div role="status" className="rounded-md border border-brass/60 bg-brass/10 px-4 py-3 text-[15px]">
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel title="3. Đặc điểm hình thể của học sinh">
          <Choice
            name="body_traits"
            legend="Chọn các đặc điểm phù hợp"
            type="checkbox"
            options={BODY_TRAITS}
            selected={values.body_traits}
            onToggle={(v) => set('body_traits', toggle(values.body_traits, v))}
          />
          <Choice
            name="fit_preference"
            legend="Học sinh thích mặc"
            type="radio"
            options={FIT_PREFERENCES}
            selected={values.fit_preference ? [values.fit_preference] : []}
            onToggle={(v) => set('fit_preference', v)}
          />
        </Panel>

        <Panel title="4. Đồng phục các năm trước">
          <Choice
            name="past_issues"
            legend="Điều học sinh chưa hài lòng (không bắt buộc)"
            type="checkbox"
            options={PAST_ISSUES}
            selected={values.past_issues}
            onToggle={(v) => set('past_issues', toggle(values.past_issues, v))}
          />
        </Panel>

        <Panel title="5. Hình thức nhận đồ">
          <Choice
            name="supply_option"
            legend="Quý phụ huynh đăng ký"
            type="radio"
            options={SUPPLY_OPTIONS}
            selected={values.supply_option ? [values.supply_option] : []}
            onToggle={(v) => set('supply_option', v)}
            error={errors.supply_option}
          />
        </Panel>
        {formError ? (
          <p role="alert" className="font-medium text-destructive">
            {formError}
          </p>
        ) : null}
        <ActionBar>
          <Button type="submit" size="lg" className={PARENT_ACTION_PRIMARY} disabled={submit.isPending}>
            {submit.isPending ? 'Đang gửi…' : 'Gửi phiếu'}
          </Button>
        </ActionBar>
      </form>
    </ParentShell>
  )
}
