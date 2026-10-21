import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { useSchools } from '@/features/catalog/hooks'
import { formatDate } from '@/lib/format'
import { useCampaigns } from '../hooks'
import { CreateCampaignDialog } from './CreateCampaignDialog'
import { StatusBadge } from './StatusBadge'

interface CampaignListProps {
  schoolId?: string
  onSchoolChange: (schoolId: string | undefined) => void
}

export function CampaignList({ schoolId, onSchoolChange }: CampaignListProps) {
  const schools = useSchools()
  const campaigns = useCampaigns(schoolId)
  const schoolName = (id: string) => schools.data?.find((s) => s.id === id)?.name ?? '—'

  const body = () => {
    if (campaigns.isPending) return <LoadingRows rows={4} />
    if (campaigns.isError) return <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
    if (campaigns.data.length === 0) {
      return (
        <EmptyState
          title="Chưa có đợt đăng ký nào"
          description="Tạo đợt cho một trường để chọn sản phẩm, đặt giá và định nghĩa bộ."
        />
      )
    }
    return (
      <ul className="divide-y divide-hairline rounded-md border border-hairline bg-card">
        {campaigns.data.map((c) => (
          <li key={c.id}>
            <Link
              to="/campaigns/$campaignId"
              params={{ campaignId: c.id }}
              search={{ tab: 'info' }}
              className="flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                  <span className="truncate">{c.name}</span>
                  <StatusBadge status={c.status} />
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {schoolName(c.school_id)} · Năm học {c.school_year} · {c.item_count} sản phẩm · {c.kit_count} bộ
                </p>
              </div>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Mở {formatDate(c.opens_at)}
                {c.closes_at ? ` · Đóng ${formatDate(c.closes_at)}` : ''}
              </p>
              <ChevronRight className="size-4 shrink-0 text-lining" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Đợt đăng ký"
        actions={<CreateCampaignDialog schools={schools.data ?? []} defaultSchoolId={schoolId} />}
      />
      <div className="max-w-xs">
        <Field id="campaign-school-filter" label="Trường">
          {(control) => (
            <NativeSelect {...control} value={schoolId ?? ''} onChange={(e) => onSchoolChange(e.target.value || undefined)}>
              <option value="">Tất cả trường</option>
              {schools.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      {body()}
    </div>
  )
}
