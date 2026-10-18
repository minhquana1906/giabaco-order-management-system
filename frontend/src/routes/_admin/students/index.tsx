import { createFileRoute } from '@tanstack/react-router'
import type { StudentListParams } from '@/features/students/api'
import { StudentList } from '@/features/students/components/StudentList'

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)
const int = (v: unknown, min: number, max = Infinity) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

export const Route = createFileRoute('/_admin/students/')({
  validateSearch: (s: Record<string, unknown>): StudentListParams => {
    const product = str(s.product)
    return {
      school_id: str(s.school_id),
      grade: int(s.grade, 1, 12),
      class_id: str(s.class_id),
      gender: s.gender === 'MALE' || s.gender === 'FEMALE' ? s.gender : undefined,
      product,
      size: product ? str(s.size) : undefined,
      q: str(s.q),
      page: int(s.page, 1),
    }
  },
  component: StudentsPage,
})

function StudentsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <StudentList
      search={search}
      onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
      onClear={() => void navigate({ search: {}, replace: true })}
    />
  )
}
