import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { SizeLabel } from '@/components/SizeLabel'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { useOrders } from '../hooks'

export function OrdersCard({ schoolId }: { schoolId: string | undefined }) {
  const query = useOrders(schoolId)
  const products = query.data?.products.filter((p) => p.total > 0) ?? []

  return (
    <Card className="min-w-0 gap-3">
      <div className="px-5">
        <h2 className="text-[15px] font-semibold">Đơn đặt may theo cỡ</h2>
        <p className="text-xs text-muted-foreground">Lựa chọn của phụ huynh, khác cỡ vừa suy ra.</p>
      </div>
      <div className="px-5">
        {query.isPending ? (
          <Skeleton className="h-[120px] w-full" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState title="Chưa có đơn đặt may" description="Số lượng hiện khi phụ huynh chọn cỡ cho con." />
        ) : (
          <ul className="divide-y divide-hairline">
            {products.map((p) => (
              <li key={p.product_code} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">{p.product_name}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(p.total)} đơn</span>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-2">
                  {p.sizes.map((s) => (
                    <li key={s.size_label} className="flex items-center gap-1.5 tabular-nums">
                      <SizeLabel label={s.size_label} />
                      <b className="text-sm font-semibold">{formatNumber(s.count)}</b>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
