import { toast } from 'sonner'
import { Hotline, LoadError, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/http'
import type { PublicStudent } from '@/features/parent_portal/api'
import { useChildren, useUpdateChild } from '../hooks'
import { DeclareForm } from './DeclareForm'

interface EditChildProps {
  studentId: string
  student: PublicStudent
  onClose: () => void
  onLocked: () => void
}

export function EditChild({ studentId, student, onClose, onLocked }: EditChildProps) {
  const children = useChildren()
  const update = useUpdateChild(studentId)
  const child = children.data?.find((c) => c.student_id === studentId)

  let body
  if (children.isPending) {
    body = (
      <div role="status" aria-label="Đang tải" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  } else if (children.isError) {
    body = <LoadError message="Chưa tải được thông tin của con." onRetry={() => void children.refetch()} />
  } else if (!child) {
    body = (
      <div role="alert" className="flex flex-col gap-4">
        <p className="font-medium text-destructive">Hồ sơ này không còn trong tài khoản của bạn.</p>
        <Button size="lg" className={PARENT_BTN} onClick={onClose}>
          Quay lại
        </Button>
        <Hotline />
      </div>
    )
  } else {
    body = (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-navy">Sửa thông tin của con</h1>
          <p className="text-balance text-muted-foreground">
            {child.full_name} · {child.school_name}. Họ tên, ngày sinh và trường không sửa được.
          </p>
        </div>
        <DeclareForm
          schoolId={child.school_id}
          initial={{
            class_id: child.class_id,
            gender: child.gender,
            height: student.height_cm == null ? '' : String(student.height_cm),
            weight: student.weight_kg == null ? '' : String(student.weight_kg),
            parent_phone: child.parent_phone ?? '',
            parent_name: child.parent_name ?? '',
            parent_email: child.parent_email ?? '',
          }}
          submitLabel="Lưu thông tin"
          pendingLabel="Đang lưu…"
          pending={update.isPending}
          error={update.error}
          onSubmit={(declared) =>
            update.mutate(declared, {
              onSuccess: onClose,
              onError: (error) => {
                if (error instanceof ApiError && error.code === 'measured_locked') {
                  toast.error(error.message)
                  onLocked()
                }
              },
            })
          }
          secondary={{ label: 'Hủy', onClick: onClose }}
        />
      </>
    )
  }

  return (
    <ParentShell onBack={onClose} backLabel="Hồ sơ của con">
      {body}
    </ParentShell>
  )
}
