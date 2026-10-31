import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClasses, useSchools } from '@/features/catalog/hooks'
import { ALL_SCHOOLS, type StudentListParams } from '../api'
import { NativeSelect } from '@/components/NativeSelect'

export type SearchPatch = Partial<StudentListParams>

interface StudentFiltersProps {
  search: StudentListParams
  schoolId: string | undefined
  onChange: (patch: SearchPatch) => void
  onClear: () => void
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export function hasActiveFilters(s: StudentListParams) {
  return Boolean(s.grade || s.class_id || s.gender || s.q)
}

export function StudentFilters({ search, schoolId, onChange, onClear }: StudentFiltersProps) {
  const classes = useClasses(schoolId)
  const schools = useSchools()
  const [q, setQ] = useState(search.q ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onSearch = (value: string) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange({ q: value.trim() || undefined, page: undefined }), 300)
  }

  const cls = classes.data?.find((c) => c.id === search.class_id)
  const visibleClasses = (classes.data ?? []).filter((c) => !search.grade || c.grade === search.grade)

  const chips: { label: string; clear: SearchPatch }[] = []
  if (search.q) chips.push({ label: `Tìm: ${search.q}`, clear: { q: undefined } })
  if (search.grade) chips.push({ label: `Khối ${search.grade}`, clear: { grade: undefined, class_id: undefined } })
  if (search.class_id) chips.push({ label: `Lớp ${cls?.name ?? ''}`.trim(), clear: { class_id: undefined } })
  if (search.gender) chips.push({ label: search.gender === 'MALE' ? 'Nam' : 'Nữ', clear: { gender: undefined } })

  const reset = { page: undefined }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Tìm tên hoặc SĐT phụ huynh"
          placeholder="Tìm tên hoặc SĐT phụ huynh"
          className="h-11 pl-9 md:h-10"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <NativeSelect
          aria-label="Trường"
          value={schoolId ?? ALL_SCHOOLS}
          onChange={(e) => onChange({ school_id: e.target.value, class_id: undefined, ...reset })}
        >
          <option value={ALL_SCHOOLS}>Tất cả trường</option>
          {schools.data?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Khối"
          value={search.grade ? String(search.grade) : ''}
          onChange={(e) => onChange({ grade: e.target.value ? Number(e.target.value) : undefined, class_id: undefined, ...reset })}
        >
          <option value="">Tất cả khối</option>
          {GRADES.map((n) => (
            <option key={n} value={n}>Khối {n}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Lớp"
          value={search.class_id ?? ''}
          disabled={!schoolId}
          title={schoolId ? undefined : 'Chọn trường trước'}
          onChange={(e) => onChange({ class_id: e.target.value || undefined, ...reset })}
        >
          <option value="">{schoolId ? 'Tất cả lớp' : 'Chọn trường trước'}</option>
          {visibleClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Giới tính"
          value={search.gender ?? ''}
          onChange={(e) => onChange({ gender: (e.target.value || undefined) as StudentListParams['gender'], ...reset })}
        >
          <option value="">Mọi giới tính</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
        </NativeSelect>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-label={`Bỏ lọc ${c.label}`}
              onClick={() => onChange({ ...c.clear, ...reset })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
            >
              {c.label}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <Button
            variant="ghost"
            className="h-11 md:h-9"
            onClick={() => {
              clearTimeout(timer.current)
              setQ('')
              onClear()
            }}
          >
            Xoá bộ lọc
          </Button>
        </div>
      ) : null}
    </div>
  )
}
