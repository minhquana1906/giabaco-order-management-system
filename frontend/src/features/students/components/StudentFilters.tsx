import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClasses, useProducts, useSchools } from '@/features/catalog/hooks'
import { UNKNOWN_SIZE_LABEL } from '@/lib/sizes'
import type { StudentListParams } from '../api'
import { NativeSelect } from '@/components/NativeSelect'

export type SearchPatch = Partial<StudentListParams>

interface StudentFiltersProps {
  search: StudentListParams
  onChange: (patch: SearchPatch) => void
  onClear: () => void
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export function hasActiveFilters(s: StudentListParams) {
  return Boolean(s.school_id || s.grade || s.class_id || s.gender || s.product || s.size || s.q)
}

export function StudentFilters({ search, onChange, onClear }: StudentFiltersProps) {
  const schools = useSchools()
  const classes = useClasses(search.school_id)
  const products = useProducts()
  const [q, setQ] = useState(search.q ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onSearch = (value: string) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange({ q: value.trim() || undefined, page: undefined }), 300)
  }

  const school = schools.data?.find((s) => s.id === search.school_id)
  const cls = classes.data?.find((c) => c.id === search.class_id)
  const product = products.data?.find((p) => p.code === search.product)
  const visibleClasses = (classes.data ?? []).filter((c) => !search.grade || c.grade === search.grade)

  const chips: { label: string; clear: SearchPatch }[] = []
  if (search.q) chips.push({ label: `Tìm: ${search.q}`, clear: { q: undefined } })
  if (search.school_id) chips.push({ label: school?.name ?? 'Trường', clear: { school_id: undefined, class_id: undefined } })
  if (search.grade) chips.push({ label: `Khối ${search.grade}`, clear: { grade: undefined, class_id: undefined } })
  if (search.class_id) chips.push({ label: `Lớp ${cls?.name ?? ''}`.trim(), clear: { class_id: undefined } })
  if (search.gender) chips.push({ label: search.gender === 'MALE' ? 'Nam' : 'Nữ', clear: { gender: undefined } })
  if (search.product) chips.push({ label: product?.name ?? 'Sản phẩm', clear: { product: undefined, size: undefined } })
  if (search.size) chips.push({ label: search.size === 'none' ? UNKNOWN_SIZE_LABEL : `Cỡ ${search.size}`, clear: { size: undefined } })

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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <NativeSelect
          aria-label="Trường"
          value={search.school_id ?? ''}
          onChange={(e) => onChange({ school_id: e.target.value || undefined, class_id: undefined, ...reset })}
        >
          <option value="">Tất cả trường</option>
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
          disabled={!search.school_id}
          title={search.school_id ? undefined : 'Chọn trường trước'}
          onChange={(e) => onChange({ class_id: e.target.value || undefined, ...reset })}
        >
          <option value="">{search.school_id ? 'Tất cả lớp' : 'Chọn trường trước'}</option>
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
        <NativeSelect
          aria-label="Sản phẩm"
          value={search.product ?? ''}
          onChange={(e) => onChange({ product: e.target.value || undefined, size: undefined, ...reset })}
        >
          <option value="">Mọi sản phẩm</option>
          {products.data?.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Cỡ"
          value={search.size ?? ''}
          disabled={!search.product}
          title={search.product ? undefined : 'Chọn sản phẩm trước'}
          onChange={(e) => onChange({ size: e.target.value || undefined, ...reset })}
        >
          <option value="">{search.product ? 'Mọi cỡ' : 'Chọn sản phẩm trước'}</option>
          {product?.sizes.map((s) => (
            <option key={s} value={s}>Cỡ {s}</option>
          ))}
          {product ? <option value="none">{UNKNOWN_SIZE_LABEL}</option> : null}
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-piping bg-card px-3 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c.label}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <Button
            variant="ghost"
            className="h-9"
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
