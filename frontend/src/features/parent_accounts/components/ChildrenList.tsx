import { Link } from '@tanstack/react-router'
import { ChevronRight, Search, UserPlus } from 'lucide-react'
import { ActionBar, PageHead, Panel } from '@/components/ParentPage'
import { LoadError, PARENT_ACTION_PRIMARY, PARENT_BTN, ParentShell } from '@/components/ParentShell'
import { SizeLabel } from '@/components/SizeLabel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ColourChip } from '@/features/parent_portal/components/ColourSelect'
import { requestErrorMessage } from '@/lib/requestError'
import type { ChildSummary } from '../api'
import { useChildren } from '../hooks'
import { AccountNav } from './AccountNav'

function AddChildLink({ className }: { className: string }) {
  return (
    <Button asChild size="lg" className={className}>
      <Link to="/parent/children/new">
        <Search /> Kiểm tra hồ sơ
      </Link>
    </Button>
  )
}

function ChildCard({ child }: { child: ChildSummary }) {
  return (
    <li>
      <Link
        to="/parent/children/$studentId"
        params={{ studentId: child.student_id }}
        className="group flex h-full min-h-11 flex-col gap-4 rounded-lg border border-hairline bg-white p-5 outline-none transition-colors hover:border-navy/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-balance text-xl font-semibold leading-tight text-navy">{child.full_name}</p>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Lớp {child.class_name} · {child.school_name}
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        {child.data_source === 'PARENT_DECLARED' ? (
          <p className="w-fit rounded-sm bg-secondary px-2 py-0.5 text-sm font-medium text-navy">Tự khai báo</p>
        ) : null}
        <div className="mt-auto border-t border-hairline pt-4">
          {child.choices.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label="Cỡ đã chọn">
              {child.choices.map((choice) => (
                <li key={choice.product_code} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-muted-foreground">{choice.product_name}</span>
                  <span className="flex items-center gap-3">
                    <ColourChip colour={choice.colour} className="text-[15px]" />
                    <SizeLabel label={choice.size_label} scale="md" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-semibold text-navy">Chưa chọn cỡ áo</p>
          )}
        </div>
      </Link>
    </li>
  )
}

export function ChildrenList() {
  const children = useChildren()

  let body
  if (children.isPending) {
    body = (
      <div role="status" aria-label="Đang tải" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    )
  } else if (children.isError) {
    body = (
      <Panel flush className="mx-auto w-full max-w-[520px]">
        <LoadError
          message={requestErrorMessage(children.error, 'Chưa tải được danh sách. Vui lòng thử lại.')}
          onRetry={() => void children.refetch()}
        />
      </Panel>
    )
  } else if (children.data.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-input bg-white px-6 py-14 text-center">
        <UserPlus className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-xl font-semibold text-navy">Chưa có hồ sơ</p>
        <AddChildLink className={`${PARENT_BTN} sm:w-auto sm:min-w-[240px]`} />
      </div>
    )
  } else {
    body = (
      <>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {children.data.map((child) => (
            <ChildCard key={child.student_id} child={child} />
          ))}
        </ul>
        <ActionBar className="md:hidden">
          <AddChildLink className={PARENT_ACTION_PRIMARY} />
        </ActionBar>
      </>
    )
  }

  return (
    <ParentShell actions={<AccountNav current="list" />} width="wide">
      <PageHead title="Thông tin học sinh" divider={false} />
      {body}
    </ParentShell>
  )
}
