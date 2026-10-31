import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { DobSelects } from '@/components/DobSelects'
import { FormSection } from '@/components/FormSection'
import { GenderToggle } from '@/components/GenderToggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useProducts, useSchoolProducts, useSchools, useSizeSuggestions } from '@/features/catalog/hooks'
import { defaultSchool } from '@/features/catalog/schoolLogic'
import { ApiError } from '@/lib/http'
import type { StudentDetail } from '../api'
import { useCreateStudent, useUpdateStudent } from '../hooks'
import { ContextStrip } from './ContextStrip'
import { Field } from './Field'
import {
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  applySuggestions,
  emptyValues,
  mapServerFields,
  newRow,
  parseMeasure,
  toPayload,
  validate,
  valuesFromStudent,
  type FormValues,
  type Suggestions,
  type TrialRow,
} from './formLogic'
import { EmptyProfile } from './EmptyProfile'
import { ProductTrialCard } from './ProductTrialCard'
import { formProducts, pickByCodes } from './scope'
import { useDebounced } from './useDebounced'

interface StudentFormProps {
  initial?: StudentDetail
  initialContext?: { schoolId: string; classId: string }
  onContextChange?: (schoolId: string, classId: string) => void
  onSaved: (student: StudentDetail) => void
  onCancel?: () => void
}

export function StudentForm({ initial, initialContext, onContextChange, onSaved, onCancel }: StudentFormProps) {
  const editing = Boolean(initial)
  const allProducts = useProducts()
  const create = useCreateStudent()
  const update = useUpdateStudent(initial?.id ?? '')
  const save = editing ? update : create
  const formRef = useRef<HTMLFormElement>(null)

  const [values, setValues] = useState<FormValues>(() => (initial ? valuesFromStudent(initial) : emptyValues()))
  const [pickedCtx, setCtx] = useState(() =>
    initial
      ? { schoolId: initial.school.id, classId: initial.class.id }
      : (initialContext ?? { schoolId: '', classId: '' }),
  )
  const schools = useSchools()
  const fallbackSchoolId = editing || pickedCtx.schoolId ? undefined : defaultSchool(schools.data ?? [])?.id
  const ctx = fallbackSchoolId ? { schoolId: fallbackSchoolId, classId: '' } : pickedCtx
  const profile = useSchoolProducts(ctx.schoolId)
  const recordedCodes = initial?.trials.map((t) => t.product_code) ?? []
  const shownProducts = profile.data && allProducts.data ? formProducts(profile.data, allProducts.data, recordedCodes) : []
  const shownCodes = shownProducts.map((p) => p.code)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<string | null>(null)
  const [parentOpen, setParentOpen] = useState(
    Boolean(initial && (initial.parent_name || initial.parent_phone || initial.parent_email)),
  )

  const debouncedHeight = useDebounced(values.height, 300)
  const debouncedWeight = useDebounced(values.weight, 300)
  const heightN = parseMeasure(debouncedHeight, HEIGHT_RANGE)
  const weightN = parseMeasure(debouncedWeight, WEIGHT_RANGE)
  const measuresOk = heightN !== null && weightN !== null
  const suggestionQuery = useSizeSuggestions(heightN, weightN)
  const suggestions: Suggestions | null = measuresOk ? (suggestionQuery.data ?? null) : null

  const codesKey = shownCodes.join(',')
  const [applied, setApplied] = useState<{ suggestions: Suggestions | null; codesKey: string }>({ suggestions: null, codesKey: '' })
  if (suggestions !== applied.suggestions || codesKey !== applied.codesKey) {
    setApplied({ suggestions, codesKey })
    if (!editing && suggestions) {
      setValues((v) => ({ ...v, trials: applySuggestions(v.trials, suggestions && pickByCodes(suggestions, shownCodes)) }))
    }
  }

  const clientErrors = validate({ ...values, trials: pickByCodes(values.trials, shownCodes) }, ctx)
  const allErrors = { ...clientErrors, ...serverErrors }
  const shown: Record<string, string> = {}
  for (const [k, m] of Object.entries(allErrors)) {
    if (submitted || touched.has(k) || k in serverErrors) shown[k] = m
  }

  const clearServerError = (key: string) =>
    setServerErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => k !== key)))

  const edit = (patch: Partial<FormValues>, errKey?: string) => {
    setValues((v) => ({ ...v, ...patch }))
    if (errKey) clearServerError(errKey)
  }
  const touch = (k: string) => setTouched((s) => new Set(s).add(k))
  const setRows = (code: string, fn: (rows: TrialRow[]) => TrialRow[]) =>
    setValues((v) => ({ ...v, trials: { ...v.trials, [code]: fn(v.trials[code] ?? []) } }))

  const changeContext = (schoolId: string, classId: string) => {
    setCtx({ schoolId, classId })
    onContextChange?.(schoolId, classId)
  }

  const submit = async (force = false) => {
    setSubmitted(true)
    setFormError(null)
    if (Object.keys(clientErrors).length > 0) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector('[role="alert"]')?.scrollIntoView?.({ block: 'center' }),
      )
      return
    }
    const { payload, rowKeys } = toPayload(values, ctx, [...new Set([...shownCodes, ...recordedCodes])], force)
    try {
      onSaved(await save.mutateAsync(payload))
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 422 && error.fields) setServerErrors(mapServerFields(error.fields, rowKeys))
      else if (error.code === 'duplicate_student') setDuplicate(error.message)
      else setFormError(error.message)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(false)
  }

  const errorCount = Object.keys(shown).length

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <ContextStrip schoolId={ctx.schoolId} classId={ctx.classId} onChange={changeContext} errors={shown} />

        <FormSection title="Học sinh">
          <Field label="Họ tên" htmlFor="full_name" error={shown.full_name}>
            <Input
              id="full_name"
              className="h-11 md:h-10"
              autoComplete="off"
              value={values.fullName}
              aria-invalid={Boolean(shown.full_name)}
              onChange={(e) => edit({ fullName: e.target.value }, 'full_name')}
              onBlur={() => touch('full_name')}
            />
          </Field>

          <DobSelects
            value={{ day: values.day, month: values.month, year: values.year }}
            error={shown.dob}
            onChange={(dob) => edit(dob, 'dob')}
          />

          <GenderToggle value={values.gender} error={shown.gender} onChange={(gender) => edit({ gender }, 'gender')} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Chiều cao (cm)" htmlFor="height_cm" error={shown.height_cm}>
              <Input
                id="height_cm"
                inputMode="decimal"
                autoComplete="off"
                className="h-11 md:h-10"
                value={values.height}
                aria-invalid={Boolean(shown.height_cm)}
                onChange={(e) => edit({ height: e.target.value }, 'height_cm')}
                onBlur={() => touch('height_cm')}
              />
            </Field>
            <Field label="Cân nặng (kg)" htmlFor="weight_kg" error={shown.weight_kg}>
              <Input
                id="weight_kg"
                inputMode="decimal"
                autoComplete="off"
                className="h-11 md:h-10"
                value={values.weight}
                aria-invalid={Boolean(shown.weight_kg)}
                onChange={(e) => edit({ weight: e.target.value }, 'weight_kg')}
                onBlur={() => touch('weight_kg')}
              />
            </Field>
          </div>
        </FormSection>

        <section className="rounded-lg border border-hairline bg-card px-4 py-1 sm:px-5">
          <button
            type="button"
            aria-expanded={parentOpen}
            aria-controls="parent-fields"
            onClick={() => setParentOpen((o) => !o)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Phụ huynh (không bắt buộc)
            {parentOpen ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
          {parentOpen || shown.parent_phone || shown.parent_email || shown.parent_name ? (
            <div id="parent-fields" className="flex flex-col gap-3 pb-4 pt-1">
              <Field label="Họ tên phụ huynh" htmlFor="parent_name" error={shown.parent_name}>
                <Input id="parent_name" className="h-11 md:h-10" value={values.parentName} onChange={(e) => edit({ parentName: e.target.value }, 'parent_name')} />
              </Field>
              <Field label="Số điện thoại" htmlFor="parent_phone" error={shown.parent_phone}>
                <Input id="parent_phone" inputMode="tel" autoComplete="off" className="h-11 md:h-10" value={values.parentPhone} aria-invalid={Boolean(shown.parent_phone)} onChange={(e) => edit({ parentPhone: e.target.value }, 'parent_phone')} />
              </Field>
              <Field label="Email" htmlFor="parent_email" error={shown.parent_email}>
                <Input id="parent_email" type="email" inputMode="email" autoComplete="off" className="h-11 md:h-10" value={values.parentEmail} aria-invalid={Boolean(shown.parent_email)} onChange={(e) => edit({ parentEmail: e.target.value }, 'parent_email')} />
              </Field>
            </div>
          ) : null}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:self-stretch">
        {!ctx.schoolId ? (
          <p className="text-muted-foreground">Chọn trường để thấy sản phẩm thử.</p>
        ) : profile.isPending || allProducts.isPending ? (
          <p role="status" className="text-muted-foreground">Đang tải danh sách sản phẩm…</p>
        ) : profile.isError || allProducts.isError ? (
          <p role="alert" className="text-destructive">Chưa tải được danh sách sản phẩm. Bấm Thử lại hoặc quay lại sau ít phút.</p>
        ) : shownProducts.length === 0 ? (
          <EmptyProfile />
        ) : (
          shownProducts.map((product) => (
            <ProductTrialCard
              key={product.code}
              product={product}
              rows={values.trials[product.code] ?? []}
              suggestion={{ ready: suggestions !== null, size: suggestions?.[product.code] ?? null }}
              errors={shown}
              onAdd={() => setRows(product.code, (rows) => [...rows, newRow()])}
              onRemove={(key) => setRows(product.code, (rows) => rows.filter((r) => r.key !== key))}
              onChange={(key, patch) => {
                setRows(product.code, (rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
                clearServerError(`trial:${key}`)
              }}
            />
          ))
        )}

        <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-2 border-t border-hairline bg-background/95 px-4 py-3 backdrop-blur md:-mx-7 md:px-7 lg:static lg:mx-0 lg:mt-0 lg:items-end lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          {submitted && errorCount > 0 ? (
            <p role="status" className="text-sm text-destructive">Còn {errorCount} mục chưa hợp lệ. Sửa các ô được đánh dấu đỏ.</p>
          ) : null}
          <div className="flex gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" size="lg" className="h-12 lg:h-11" onClick={onCancel}>
                Huỷ
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="h-12 flex-1 text-base lg:h-11 lg:flex-none lg:px-8" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {editing ? 'Lưu thay đổi' : 'Lưu học sinh'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={duplicate !== null} onOpenChange={(open) => !open && setDuplicate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Có thể đã nhập học sinh này</DialogTitle>
            <DialogDescription>{duplicate}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicate(null)}>
              Xem lại
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDuplicate(null)
                void submit(true)
              }}
            >
              Vẫn lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
