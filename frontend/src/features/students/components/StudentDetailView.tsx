import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2, Unlink } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { SizeLabel } from '@/components/SizeLabel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSchoolProducts } from '@/features/catalog/hooks'
import { formatCm, formatDate, formatDateTime, formatKg } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { requestErrorMessage } from '@/lib/requestError'
import type { LinkedParent, StudentDetail } from '../api'
import { useDeleteStudent, useStudent, useUnlinkParent } from '../hooks'
import { DataSourceBadge } from './DataSourceBadge'
import { FitBadge } from './FitBadge'
import { QrCard } from './QrCard'
import { StudentForm } from './StudentForm'
import { detailProducts } from './scope'

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-[15px]">{children || '—'}</dd>
    </div>
  )
}

function DeleteDialog({ student, open, onOpenChange }: { student: StudentDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const remove = useDeleteStudent(student.id)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá học sinh {student.full_name}?</DialogTitle>
          <DialogDescription>
            Hồ sơ sẽ bị ẩn khỏi danh sách và thống kê (xoá mềm). Mọi thay đổi vẫn được lưu lại trong nhật ký hệ thống.
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <p role="alert" className="text-sm text-destructive">
            {requestErrorMessage(remove.error, remove.error instanceof ApiError ? remove.error.message : 'Chưa xóa được hồ sơ. Vui lòng thử lại sau ít phút.')}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Giữ lại
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Đã xoá ${student.full_name}`)
                  void navigate({ to: '/students' })
                },
              })
            }
          >
            Xoá học sinh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkDialog({
  studentId,
  parent,
  onClose,
}: {
  studentId: string
  parent: LinkedParent | null
  onClose: () => void
}) {
  const unlink = useUnlinkParent(studentId)
  const [shown, setShown] = useState(parent)
  if (parent && parent !== shown) setShown(parent)
  return (
    <Dialog
      open={parent !== null}
      onOpenChange={(open) => {
        if (!open) {
          unlink.reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gỡ liên kết với {shown?.full_name}?</DialogTitle>
          <DialogDescription>
            Tài khoản này sẽ không còn thấy hồ sơ của học sinh. Có thể liên kết lại khi phụ huynh nhận lại hồ sơ.
          </DialogDescription>
        </DialogHeader>
        {unlink.error ? (
          <p role="alert" className="text-sm text-destructive">
            {requestErrorMessage(unlink.error, unlink.error instanceof ApiError ? unlink.error.message : 'Chưa gỡ được liên kết. Vui lòng thử lại sau ít phút.')}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={unlink.isPending} onClick={onClose}>
            Giữ liên kết
          </Button>
          <Button
            variant="destructive"
            disabled={unlink.isPending || !parent}
            onClick={() =>
              parent &&
              unlink.mutate(parent.parent_id, {
                onSuccess: () => {
                  toast.success(`Đã gỡ liên kết với ${parent.full_name}`)
                  onClose()
                },
              })
            }
          >
            Gỡ liên kết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Profile({ student }: { student: StudentDetail }) {
  const [unlinking, setUnlinking] = useState<LinkedParent | null>(null)
  const profile = useSchoolProducts(student.school.id)
  const productList = detailProducts(profile.data?.map((p) => ({ code: p.code, name: p.name })) ?? [], student.trials)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="gap-4 p-4">
          <h2 className="text-base font-semibold">Thông tin</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Info label="Ngày sinh">{formatDate(student.dob)}</Info>
            <Info label="Giới tính">{student.gender === 'MALE' ? 'Nam' : 'Nữ'}</Info>
            <Info label="Ngày đo">{formatDate(student.measured_at)}</Info>
            <Info label="Chiều cao">{formatCm(student.height_cm)}</Info>
            <Info label="Cân nặng">{formatKg(student.weight_kg)}</Info>
            <Info label="Phụ huynh">{student.parent_name}</Info>
            <Info label="Số điện thoại">{student.parent_phone}</Info>
            <Info label="Email">{student.parent_email}</Info>
          </dl>
        </Card>

        {productList.map((p) => {
          const trials = student.trials.filter((t) => t.product_code === p.code)
          const derived = student.derived_sizes[p.code] ?? null
          return (
            <Card key={p.code} className="gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{p.name}</h2>
                <p className="flex items-center gap-2 text-sm">
                  Cỡ vừa (suy ra): <SizeLabel label={derived} scale="md" />
                </p>
              </div>
              {trials.length === 0 ? (
                <p className="text-muted-foreground">Chưa có lần thử nào cho học sinh này.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {trials.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                      <SizeLabel label={t.size_label} />
                      <FitBadge fit={t.fit} />
                      {t.suggested_size_label ? (
                        <span className="text-sm text-muted-foreground">gợi ý cỡ {t.suggested_size_label}</span>
                      ) : null}
                      {t.note ? <span className="basis-full text-sm">{t.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="gap-3 p-4">
          <h2 className="text-base font-semibold">Mã QR phụ huynh</h2>
          <QrCard portalUrl={student.portal_url} fileName={`qr-${student.full_name}`} size={240} showOpen />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-base font-semibold">Tài khoản phụ huynh liên kết</h2>
          {student.linked_parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có phụ huynh nào liên kết. Gửi mã QR để phụ huynh nhận hồ sơ.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {student.linked_parents.map((p) => (
                <li key={p.parent_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.phone ?? p.email}</p>
                    <p className="text-xs text-muted-foreground">Liên kết {formatDateTime(p.linked_at)}</p>
                  </div>
                  <Button variant="outline" className="h-11 shrink-0 md:h-9" onClick={() => setUnlinking(p)}>
                    <Unlink /> Gỡ liên kết
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <UnlinkDialog studentId={student.id} parent={unlinking} onClose={() => setUnlinking(null)} />
    </div>
  )
}

export function StudentDetailView({ studentId }: { studentId: string }) {
  const query = useStudent(studentId)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (query.isPending) return <LoadingRows rows={6} />
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <ErrorState
        error={query.error}
        message={notFound ? 'Không tìm thấy học sinh này. Hồ sơ có thể đã bị xoá.' : undefined}
        onRetry={notFound ? undefined : () => void query.refetch()}
      />
    )
  }
  const student = query.data

  return (
    <div className="flex flex-col gap-4">
      <Link to="/students" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden="true" /> Học sinh
      </Link>
      <div>
        <PageHeader
          title={student.full_name}
          actions={
            editing ? null : (
              <>
                <Button variant="outline" className="h-11 md:h-9" onClick={() => setEditing(true)}>
                  <Pencil /> Sửa
                </Button>
                <Button variant="outline" className="h-11 text-destructive md:h-9" onClick={() => setDeleting(true)}>
                  <Trash2 /> Xoá
                </Button>
              </>
            )
          }
        />
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
          Lớp {student.class.name} · {student.school.name}
          <DataSourceBadge source={student.data_source} />
        </p>
      </div>

      {editing ? (
        <StudentForm
          initial={student}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            toast.success('Đã lưu thay đổi')
            setEditing(false)
          }}
        />
      ) : (
        <Profile student={student} />
      )}
      <DeleteDialog student={student} open={deleting} onOpenChange={setDeleting} />
    </div>
  )
}
