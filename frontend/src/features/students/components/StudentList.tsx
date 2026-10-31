import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, MessageSquareText, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSchools } from '@/features/catalog/hooks'
import { defaultSchool } from '@/features/catalog/schoolLogic'
import { ExportMenu } from '@/features/exports/components/ExportMenu'
import { formatNumber } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { ALL_SCHOOLS, STUDENTS_PAGE_SIZE, type StudentListItem, type StudentListParams } from '../api'
import { useStudents } from '../hooks'
import { DataSourceBadge } from './DataSourceBadge'
import { StudentFilters, hasActiveFilters, type SearchPatch } from './StudentFilters'

interface StudentListProps {
  search: StudentListParams
  onSearchChange: (patch: SearchPatch) => void
  onClear: () => void
}

const genderText = (g: StudentListItem['gender']) => (g === 'MALE' ? 'Nam' : 'Nữ')

function OrderStatus({ placed }: { placed: boolean }) {
  return placed ? <Badge variant="success">Đã đặt</Badge> : <span className="text-muted-foreground">Chưa</span>
}

export function StudentList({ search, onSearchChange, onClear }: StudentListProps) {
  const schools = useSchools()
  const schoolId =
    search.school_id === ALL_SCHOOLS
      ? undefined
      : (search.school_id ?? (schools.isPending ? undefined : defaultSchool(schools.data ?? [])?.id))
  const query = useStudents(
    { ...search, school_id: schoolId },
    search.school_id !== undefined || !schools.isPending,
  )
  const filtered = hasActiveFilters(search)
  const page = search.page ?? 1

  const body = () => {
    if (query.isPending) return <LoadingRows rows={8} />
    if (query.isError)
      return (
        <ErrorState
          error={query.error}
          message={
            query.error instanceof ApiError
              ? undefined
              : 'Chưa tải được danh sách học sinh. Bấm Thử lại hoặc quay lại sau ít phút.'
          }
          onRetry={() => void query.refetch()}
        />
      )
    const { items, total } = query.data
    if (items.length === 0) {
      return filtered ? (
        <EmptyState
          title="Không có học sinh khớp bộ lọc"
          action={<Button variant="outline" onClick={onClear}>Xoá bộ lọc</Button>}
        />
      ) : (
        <EmptyState
          title="Chưa có học sinh nào"
          action={
            <Button asChild>
              <Link to="/students/new">Thêm học sinh đầu tiên</Link>
            </Button>
          }
        />
      )
    }
    const pages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE))
    const from = (page - 1) * STUDENTS_PAGE_SIZE + 1
    const to = Math.min(total, from + items.length - 1)
    return (
      <>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Lớp / Trường</TableHead>
                <TableHead>Giới tính</TableHead>
                <TableHead className="text-right">Chiều cao</TableHead>
                <TableHead className="text-right">Cân nặng</TableHead>
                <TableHead className="text-center">Lần thử</TableHead>
                <TableHead className="text-center">Đơn</TableHead>
                <TableHead className="text-center">Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} className="relative hover:bg-accent/50">
                  <TableCell className="font-semibold">
                    <Link
                      to="/students/$studentId"
                      params={{ studentId: s.id }}
                      className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {s.full_name}
                    </Link>
                    <DataSourceBadge source={s.data_source} />
                  </TableCell>
                  <TableCell>
                    Lớp {s.class.name}
                    <div className="text-xs text-muted-foreground">{s.school.name}</div>
                  </TableCell>
                  <TableCell>{genderText(s.gender)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(s.height_cm, 1)} cm</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(s.weight_kg, 1)} kg</TableCell>
                  <TableCell className="text-center tabular-nums">{s.trial_count}</TableCell>
                  <TableCell className="text-center">
                    <OrderStatus placed={s.has_order} />
                  </TableCell>
                  <TableCell className="text-center">
                    {s.has_note ? <MessageSquareText className="mx-auto size-4" role="img" aria-label="Có ghi chú" /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="divide-y divide-hairline md:hidden">
          {items.map((s) => (
            <li key={s.id}>
              <Link to="/students/$studentId" params={{ studentId: s.id }} className="flex min-h-14 flex-col gap-1.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.full_name}</span>
                    <DataSourceBadge source={s.data_source} />
                  </span>
                  {s.has_note ? <MessageSquareText className="size-4 shrink-0" role="img" aria-label="Có ghi chú" /> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  Lớp {s.class.name} · {genderText(s.gender)} · {formatNumber(s.height_cm, 1)} cm · {formatNumber(s.weight_kg, 1)} kg
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>{s.school.name}</span>
                  <span className="tabular-nums">{s.trial_count} lần thử</span>
                  <OrderStatus placed={s.has_order} />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <p className="text-sm text-muted-foreground">
            {from}–{to} / {formatNumber(total)}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-11 md:h-9" disabled={page <= 1} onClick={() => onSearchChange({ page: page - 1 <= 1 ? undefined : page - 1 })}>
              <ChevronLeft /> Trước
            </Button>
            <span className="text-sm tabular-nums">Trang {page}/{pages}</span>
            <Button variant="outline" className="h-11 md:h-9" disabled={page >= pages} onClick={() => onSearchChange({ page: page + 1 })}>
              Sau <ChevronRight />
            </Button>
          </div>
        </nav>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Danh sách học sinh"
        actions={
          <>
            <ExportMenu schoolId={schoolId} />
            <Button className="h-11 md:h-9" asChild>
              <Link to="/students/new">
                <Plus /> Thêm học sinh
              </Link>
            </Button>
          </>
        }
      />
      {query.data ? <p className="-mt-2 text-muted-foreground">{formatNumber(query.data.total)} học sinh</p> : null}
      <StudentFilters search={search} schoolId={schoolId} onChange={onSearchChange} onClear={onClear} />
      {body()}
    </div>
  )
}
