import { Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { School, SchoolClass } from '@/features/catalog/api'
import {
  useClasses,
  useCreateClass,
  useCreateSchool,
  useSchools,
  useUpdateClass,
  useUpdateSchool,
} from '@/features/catalog/hooks'
import { ApiError } from '@/lib/http'
import { gradeFromName, GRADES, withGrade } from './className'
import { Field } from './Field'
import { NativeSelect } from '@/components/NativeSelect'

interface ContextStripProps {
  schoolId: string
  classId: string
  onChange: (schoolId: string, classId: string) => void
  errors: { school_id?: string; class_id?: string }
}

function errorText(e: unknown) {
  if (!(e instanceof ApiError)) return 'Không lưu được, thử lại.'
  return Object.values(e.fields ?? {})[0] ?? e.message
}

function SchoolPopover({ school, onSaved }: { school?: School; onSaved?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const create = useCreateSchool()
  const update = useUpdateSchool(school?.id ?? '')
  const mutation = school ? update : create
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const saved = await (school
      ? update.mutateAsync({ name: name.trim() })
      : create.mutateAsync({ name: name.trim(), code: code.trim() })
    ).catch(() => null)
    if (!saved) return
    onSaved?.(saved.id)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setName(school?.name ?? '')
          setCode('')
          mutation.reset()
        }
      }}
    >
      <PopoverTrigger asChild>
        {school ? (
          <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 md:size-10" aria-label="Sửa tên trường">
            <Pencil />
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11 md:h-10">
            <Plus /> Thêm trường
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Tên trường" htmlFor="school-name">
            <Input id="school-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {school ? null : (
            <Field label="Mã trường" htmlFor="school-code">
              <Input id="school-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field>
          )}
          {mutation.error ? <p role="alert" className="text-sm text-destructive">{errorText(mutation.error)}</p> : null}
          <Button type="submit" disabled={mutation.isPending || !name.trim() || (!school && !code.trim())}>
            {school ? 'Lưu trường' : 'Thêm trường'}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

interface ClassPopoverProps {
  schoolId: string
  grade: string
  cls?: SchoolClass
  onSaved: (c: { id: string; grade: number }) => void
}

function ClassPopover({ schoolId, grade, cls, onSaved }: ClassPopoverProps) {
  const [open, setOpen] = useState(false)
  const [g, setG] = useState(grade)
  const [name, setName] = useState('')
  const create = useCreateClass(schoolId)
  const update = useUpdateClass(schoolId, cls?.id ?? '')
  const mutation = cls ? update : create
  const mismatch = Boolean(g) && Boolean(name.trim()) && gradeFromName(name) !== Number(g)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = { grade: Number(g), name: name.trim() }
    const saved = await (cls ? update.mutateAsync(body) : create.mutateAsync(body)).catch(() => null)
    if (!saved) return
    onSaved(saved)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setG(cls ? String(cls.grade) : grade)
          setName(cls ? cls.name : grade)
          mutation.reset()
        }
      }}
    >
      <PopoverTrigger asChild>
        {cls ? (
          <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 md:size-10" aria-label="Sửa lớp">
            <Pencil />
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11 md:h-10" disabled={!schoolId}>
            <Plus /> Thêm lớp mới
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Khối" htmlFor="class-grade">
            <NativeSelect
              id="class-grade"
              value={g}
              onChange={(e) => {
                setG(e.target.value)
                if (e.target.value) setName(withGrade(name, e.target.value))
              }}
              required
            >
              <option value="">Chọn khối</option>
              {GRADES.map((n) => (
                <option key={n} value={n}>
                  Khối {n}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Tên lớp"
            htmlFor="class-name"
            error={mismatch ? `Tên lớp phải bắt đầu bằng số khối (khối ${g} → ${g}A1)` : undefined}
          >
            <Input
              id="class-name"
              placeholder="2A3"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                const detected = gradeFromName(e.target.value)
                if (detected) setG(String(detected))
              }}
              required
            />
          </Field>
          {mutation.error ? <p role="alert" className="text-sm text-destructive">{errorText(mutation.error)}</p> : null}
          <Button type="submit" disabled={mutation.isPending || !name.trim() || !g || mismatch}>
            {cls ? 'Lưu lớp' : 'Thêm lớp'}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function ContextStrip({ schoolId, classId, onChange, errors }: ContextStripProps) {
  const schools = useSchools()
  const classes = useClasses(schoolId || undefined)
  const [gradeSel, setGradeSel] = useState('')
  const [expanded, setExpanded] = useState(false)

  const school = schools.data?.find((s) => s.id === schoolId)
  const cls = classes.data?.find((c) => c.id === classId)
  const grade = gradeSel || (cls ? String(cls.grade) : '')
  const visibleClasses = (classes.data ?? []).filter((c) => !grade || String(c.grade) === grade)

  if (school && cls && !expanded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-card px-3 py-2.5">
        <p className="min-w-0 text-[15px]">
          <span className="font-semibold">{school.name}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="whitespace-nowrap font-semibold">Lớp {cls.name}</span>
        </p>
        <Button type="button" variant="ghost" className="h-11 shrink-0 md:h-9" onClick={() => setExpanded(true)}>
          Đổi
        </Button>
      </div>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-hairline bg-card p-3">
      <legend className="px-1 text-sm font-semibold">Lớp đo</legend>
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
        <Field label="Trường" htmlFor="ctx-school" error={errors.school_id}>
          <div className="flex gap-2">
            <NativeSelect
              id="ctx-school"
              value={school ? schoolId : ''}
              aria-invalid={Boolean(errors.school_id)}
              onChange={(e) => {
                setGradeSel('')
                onChange(e.target.value, '')
              }}
            >
              <option value="">Chọn trường</option>
              {schools.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            {school ? <SchoolPopover school={school} /> : null}
          </div>
        </Field>
        <Field label="Khối" htmlFor="ctx-grade">
          <NativeSelect
            id="ctx-grade"
            value={grade}
            disabled={!schoolId}
            onChange={(e) => {
              setGradeSel(e.target.value)
              if (cls && String(cls.grade) !== e.target.value) onChange(schoolId, '')
            }}
          >
            <option value="">Tất cả khối</option>
            {GRADES.map((n) => (
              <option key={n} value={n}>
                Khối {n}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Lớp" htmlFor="ctx-class" error={errors.class_id}>
          <div className="flex gap-2">
            <NativeSelect
              id="ctx-class"
              value={cls ? classId : ''}
              disabled={!schoolId}
              aria-invalid={Boolean(errors.class_id)}
              onChange={(e) => {
                onChange(schoolId, e.target.value)
                if (e.target.value) setExpanded(false)
              }}
            >
              <option value="">Chọn lớp</option>
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            {cls ? <ClassPopover schoolId={schoolId} grade={grade} cls={cls} onSaved={(c) => setGradeSel(String(c.grade))} /> : null}
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <SchoolPopover
          onSaved={(id) => {
            setGradeSel('')
            onChange(id, '')
          }}
        />
        <ClassPopover
          schoolId={schoolId}
          grade={grade}
          onSaved={(c) => {
            setGradeSel(String(c.grade))
            onChange(schoolId, c.id)
            setExpanded(false)
          }}
        />
      </div>
    </fieldset>
  )
}
