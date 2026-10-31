import { Link } from '@tanstack/react-router'
import { ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge as CampaignStatusBadge } from '@/features/campaigns/components/StatusBadge'
import { useCampaigns } from '@/features/campaigns/hooks'
import { useSchools } from '@/features/catalog/hooks'
import { defaultCampaignId } from '@/features/campaigns/logic'
import { formatDate, formatNumber, formatVnd } from '@/lib/format'
import { ORDERS_PAGE_SIZE, type OrderGenderFilter, type OrderListParams, type OrderStatus } from '../api'
import { useOrders } from '../hooks'
import { genderText } from '../logic'
import { OrderStatusBadge } from './OrderStatusBadge'

export interface OrderSearch extends OrderListParams {
  campaign_id?: string
}

interface OrderListProps {
  search: OrderSearch
  onSearchChange: (patch: Partial<OrderSearch>) => void
}

function Total({ total, unpriced }: { total: number; unpriced: boolean }) {
  return (
    <span className="tabular-nums">
      {unpriced ? <span className="mr-2 text-xs font-normal text-muted-foreground">chưa đủ giá</span> : null}
      {formatVnd(total)}
    </span>
  )
}

export function OrderList({ search, onSearchChange }: OrderListProps) {
  const schools = useSchools()
  const campaigns = useCampaigns(undefined)
  const schoolName = (id: string) => schools.data?.find((s) => s.id === id)?.name ?? ''
  const campaignList = campaigns.data ?? []
  const campaign = campaignList.find((c) => c.id === search.campaign_id)
  const fallback = campaignList.find((c) => c.id === defaultCampaignId(campaignList))
  const campaignId = campaign?.id ?? fallback?.id
  const selected = campaign ?? fallback
  const page = search.page ?? 1
  const params: OrderListParams = { q: search.q, gender: search.gender, status: search.status, page }
  const query = useOrders(campaignId, params)

  const [q, setQ] = useState(search.q ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onSearch = (value: string) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearchChange({ q: value.trim() || undefined, page: undefined }), 300)
  }
  const filtered = Boolean(search.q || search.gender || search.status)
  const clear = () => {
    setQ('')
    onSearchChange({ q: undefined, gender: undefined, status: undefined, page: undefined })
  }

  const body = () => {
    if (campaigns.isPending) return <LoadingRows rows={6} />
    if (campaigns.isError) return <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
    if (!campaignId) {
      return (
        <EmptyState
          title="Chưa có đợt đăng ký nào"
          description="Tạo đợt ở mục Đợt đăng ký trước khi nhận đơn."
        />
      )
    }
    if (query.isPending) return <LoadingRows rows={8} />
    if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    const { items, total } = query.data
    if (items.length === 0) {
      return filtered ? (
        <EmptyState
          title="Không có đơn khớp bộ lọc"
          action={
            <Button variant="outline" onClick={clear}>
              Xoá bộ lọc
            </Button>
          }
        />
      ) : (
        <EmptyState title="Đợt này chưa có đơn nào" description="Đơn xuất hiện khi phụ huynh gửi đăng ký hoặc nhân viên tạo đơn." />
      )
    }
    const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE))
    const from = (page - 1) * ORDERS_PAGE_SIZE + 1
    const to = from + items.length - 1
    return (
      <>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Người nhận</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Giới tính</TableHead>
                <TableHead className="text-right">Số món</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id} className="relative hover:bg-accent/50">
                  <TableCell className="font-mono text-[13px]">
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold">{o.recipient_name}</TableCell>
                  <TableCell>{o.class_label ?? '—'}</TableCell>
                  <TableCell>{genderText(o.gender)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(o.item_count)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Total total={o.total} unpriced={o.has_unpriced} />
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y divide-hairline rounded-md border border-hairline bg-card md:hidden">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                className="flex min-h-16 items-center gap-3 px-3 py-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                    <span className="truncate">{o.recipient_name}</span>
                    <OrderStatusBadge status={o.status} />
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{o.code}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {o.class_label ? `Lớp ${o.class_label} · ` : ''}
                    {formatNumber(o.item_count)} món · <Total total={o.total} unpriced={o.has_unpriced} />
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-lining" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="tabular-nums">
            {from}–{to} / {formatNumber(total)} đơn
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={page <= 1}
              onClick={() => onSearchChange({ page: page - 1 <= 1 ? undefined : page - 1 })}
            >
              Trước
            </Button>
            <span className="tabular-nums">
              Trang {page}/{pages}
            </span>
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={page >= pages}
              onClick={() => onSearchChange({ page: page + 1 })}
            >
              Sau
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Đơn hàng" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field id="order-campaign" label="Đợt đăng ký" className="col-span-2">
          {(control) => (
            <NativeSelect
              {...control}
              value={campaignId ?? ''}
              onChange={(e) => onSearchChange({ campaign_id: e.target.value, page: undefined })}
            >
              {campaignList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {schoolName(c.school_id)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="relative col-span-2 md:col-span-1 md:col-start-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Tìm tên người nhận hoặc mã đơn"
            placeholder="Tìm tên hoặc mã đơn"
            className="h-11 pl-9 md:h-10"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Giới tính"
          value={search.gender ?? ''}
          onChange={(e) => onSearchChange({ gender: (e.target.value || undefined) as OrderGenderFilter | undefined, page: undefined })}
        >
          <option value="">Mọi giới tính</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
          <option value="UNKNOWN">Chưa rõ</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Trạng thái"
          value={search.status ?? ''}
          onChange={(e) => onSearchChange({ status: (e.target.value || undefined) as OrderStatus | undefined, page: undefined })}
        >
          <option value="">Mọi trạng thái</option>
          <option value="SUBMITTED">Đã gửi</option>
          <option value="DRAFT">Nháp</option>
        </NativeSelect>
      </div>
      {selected ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <CampaignStatusBadge status={selected.status} />
          Năm học {selected.school_year} · Mở {formatDate(selected.opens_at)}
          {filtered ? (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={clear}>
              <X /> Xoá bộ lọc
            </Button>
          ) : null}
        </p>
      ) : null}
      {body()}
    </div>
  )
}

