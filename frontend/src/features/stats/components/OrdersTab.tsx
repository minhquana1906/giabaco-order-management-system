import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Download, Loader2, Tag } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { ButtonMeter } from '@/components/ButtonMeter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { StatBlock } from '@/components/StatBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Product } from '@/features/catalog/api'
import { useCampaign, useCampaigns } from '@/features/campaigns/hooks'
import { defaultCampaignId, STATUS_LABEL } from '@/features/campaigns/logic'
import { ApiError } from '@/lib/http'
import { formatNumber } from '@/lib/format'
import { statsApi, type CampaignOverview, type PivotGroup } from '../api'
import type { DashboardParams, DashboardSearch } from '../dashboardSearch'
import { useCampaignOverview, useCampaignPivot } from '../hooks'
import {
  GENDERS,
  GROUPS,
  MEASURES,
  MEASURE_CAPTION,
  amountKpi,
  buildMatrix,
  progressMeterFill,
  resolveGroup,
  unpricedBannerText,
} from '../pivotLogic'
import { PivotMatrix } from './PivotMatrix'
import { ProductSelect } from './ProductSelect'
import { ViewSwitch } from './ViewSwitch'

const SOURCE_LABEL: Record<string, string> = {
  PARENT: 'Phụ huynh',
  STAFF: 'Nhân viên',
  LEGACY_IMPORT: 'Dữ liệu cũ',
}

export type SearchPatch = Partial<Record<keyof DashboardSearch, string | undefined>>

interface OrdersTabProps {
  schoolId: string | undefined
  params: DashboardParams
  products: Product[]
  onChange: (patch: SearchPatch) => void
}

function OrdersKpis({ overview }: { overview: CampaignOverview }) {
  const sources = Object.entries(overview.by_source)
    .map(([source, count]) => `${SOURCE_LABEL[source] ?? source} ${formatNumber(count)}`)
    .join(' · ')
  const amount = amountKpi(overview)
  const hasProgress = overview.students_total > 0
  const percent = hasProgress ? Math.round((overview.students_with_order / overview.students_total) * 100) : 0

  return (
    <div
      className={
        hasProgress
          ? 'grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.3fr)] xl:gap-4'
          : 'grid grid-cols-2 gap-3 xl:grid-cols-3 xl:gap-4'
      }
    >
      <StatBlock label="Số đơn" value={overview.orders} sub={sources || undefined} className="max-sm:px-4" />
      {hasProgress ? (
        <div className="rounded-lg max-sm:order-last max-sm:col-span-2 border bg-card px-5 py-3 max-sm:px-4">
          <p className="text-[13px] text-muted-foreground">Tiến độ đăng ký</p>
          <p className="mt-1 text-[30px] font-semibold leading-[1.1] tabular-nums">
            {formatNumber(overview.students_with_order)}
            <span className="text-base font-normal text-muted-foreground">
              {' '}
              / {formatNumber(overview.students_total)} học sinh
            </span>
          </p>
          <ButtonMeter
            className="mt-2"
            filled={progressMeterFill(overview.students_with_order, overview.students_total)}
            label={`${percent}% học sinh đã có đơn`}
          />
        </div>
      ) : null}
      <StatBlock label="Tổng số lượng (cái)" value={overview.items} className="max-sm:px-4" />
      <StatBlock label="Tạm tính" value={amount.value} sub={amount.note} className="max-sm:col-span-2 max-sm:px-4" />
    </div>
  )
}

function UnpricedBanner({ count, campaignId }: { count: number; campaignId: string }) {
  return (
    <Link
      to="/campaigns/$campaignId"
      params={{ campaignId }}
      search={{ tab: 'items' }}
      className="flex min-h-11 items-center gap-2.5 rounded-lg border bg-secondary px-4 py-2.5 text-[13px] font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Tag className="size-4 shrink-0 text-lining" aria-hidden="true" />
      <span className="min-w-0 flex-1">{unpricedBannerText(count)}</span>
      <ChevronRight className="size-4 shrink-0 text-lining" aria-hidden="true" />
    </Link>
  )
}

interface MatrixSectionProps {
  campaignId: string
  group: PivotGroup
  productId?: string
  subject: string
  params: DashboardParams
}

function MatrixSection({ campaignId, group, productId, subject, params }: MatrixSectionProps) {
  const query = useCampaignPivot({
    campaignId,
    measure: params.measure,
    group,
    productId,
    submittedUntil: params.until,
  })
  const matrix = useMemo(
    () => (query.data ? buildMatrix(query.data, params.measure, params.gender) : undefined),
    [query.data, params.measure, params.gender],
  )

  if (query.isPending) return <LoadingRows rows={4} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!matrix || matrix.rows.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" description="Đợt này chưa có đơn hoặc chưa cấu hình sản phẩm, bộ." />
  }
  return <PivotMatrix matrix={matrix} group={group} measure={params.measure} subject={subject} />
}

function ClassSection({
  campaignId,
  products,
  params,
  onChange,
}: {
  campaignId: string
  products: Product[]
  params: DashboardParams
  onChange: (patch: SearchPatch) => void
}) {
  const campaign = useCampaign(campaignId)
  if (campaign.isPending) return <LoadingRows rows={3} />
  if (campaign.isError) return <ErrorState error={campaign.error} onRetry={() => void campaign.refetch()} />

  const inCampaign = new Set(campaign.data.items.map((i) => i.product_id))
  const chips = products.filter((p) => inCampaign.has(p.id))
  const active = chips.find((p) => p.code === params.product) ?? chips[0]
  if (!active) {
    return <EmptyState title="Đợt chưa có sản phẩm" description="Thêm sản phẩm vào đợt để xem thống kê theo lớp." />
  }
  return (
    <div className="flex flex-col gap-3">
      {chips.length > 1 ? (
        <ProductSelect products={chips} value={active.code} onChange={(code) => onChange({ product: code })} />
      ) : null}
      <MatrixSection
        campaignId={campaignId}
        group="class"
        productId={active.id}
        subject={`${active.name} theo lớp`}
        params={params}
      />
    </div>
  )
}

export function OrdersTab({ schoolId, params, products, onChange }: OrdersTabProps) {
  const campaigns = useCampaigns(schoolId)
  const selected = campaigns.data?.find((c) => c.id === params.campaignId) ??
    campaigns.data?.find((c) => c.id === defaultCampaignId(campaigns.data ?? []))
  const campaignId = selected?.id
  const group = resolveGroup(params.group, selected?.kit_count ?? 0)
  const overview = useCampaignOverview(campaignId, params.until)
  const download = useMutation({
    mutationFn: statsApi.exportCampaignOrders,
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Chưa tải được bảng kê. Vui lòng thử lại sau ít phút.'),
  })

  if (campaigns.isPending) return <LoadingRows rows={4} />
  if (campaigns.isError) return <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
  if (!selected || !campaignId) {
    return (
      <EmptyState
        title="Trường chưa có đợt đăng ký"
        description="Tạo một đợt đăng ký để xem thống kê đơn."
        action={
          <Button asChild>
            <Link to="/campaigns" search={schoolId ? { school_id: schoolId } : {}}>
              Tạo đợt đăng ký
            </Link>
          </Button>
        }
      />
    )
  }

  const groups = GROUPS.filter((g) => g.value !== 'kit' || selected.kit_count > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5 max-sm:w-full">
          <Label htmlFor="orders-campaign">Đợt</Label>
          <Select value={campaignId} onValueChange={(id) => onChange({ campaign_id: id })}>
            <SelectTrigger id="orders-campaign" className="w-full min-w-0 sm:w-[300px] max-sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaigns.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {`${c.name} · ${STATUS_LABEL[c.status]}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orders-until">Chốt đến ngày</Label>
          <Input
            id="orders-until"
            type="date"
            value={params.until ?? ''}
            onChange={(e) => onChange({ until: e.target.value || undefined })}
            className="w-[170px] max-sm:h-11"
          />
        </div>
        <ViewSwitch
          value={params.measure}
          onChange={(measure) => onChange({ measure })}
          options={MEASURES}
          label="Đại lượng thống kê"
        />
        <ViewSwitch
          value={params.gender}
          onChange={(gender) => onChange({ gender })}
          options={GENDERS}
          label="Giới tính"
        />
        <Button
          variant="outline"
          className="h-11 md:h-9"
          disabled={download.isPending}
          onClick={() => download.mutate({ campaignId, submittedUntil: params.until })}
        >
          {download.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Xuất bảng kê
        </Button>
      </div>

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.data ? (
        <>
          <OrdersKpis overview={overview.data} />
          {overview.data.unpriced_items > 0 ? (
            <UnpricedBanner count={overview.data.unpriced_items} campaignId={campaignId} />
          ) : null}
        </>
      ) : (
        <LoadingRows rows={2} />
      )}

      <Card className="min-w-0 gap-3 px-5">
        <h2 className="sr-only">Thống kê theo cỡ</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewSwitch
            value={group}
            onChange={(next) => onChange({ group: next })}
            options={groups}
            label="Nhóm thống kê"
          />
        </div>
        {group === 'class' ? (
          <ClassSection campaignId={campaignId} products={products} params={params} onChange={onChange} />
        ) : (
          <MatrixSection
            campaignId={campaignId}
            group={group}
            subject={group === 'kit' ? 'Theo bộ' : 'Theo sản phẩm'}
            params={params}
          />
        )}
        <p className="text-[13px] text-muted-foreground">{MEASURE_CAPTION[params.measure]}</p>
      </Card>
    </div>
  )
}
