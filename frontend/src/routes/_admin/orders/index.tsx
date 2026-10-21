import { createFileRoute } from '@tanstack/react-router'
import { OrderList, type OrderSearch } from '@/features/orders/components/OrderList'

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)

export const Route = createFileRoute('/_admin/orders/')({
  validateSearch: (s: Record<string, unknown>): OrderSearch => {
    const page = Number(s.page)
    return {
      campaign_id: str(s.campaign_id),
      q: str(s.q),
      gender: s.gender === 'MALE' || s.gender === 'FEMALE' || s.gender === 'UNKNOWN' ? s.gender : undefined,
      status: s.status === 'DRAFT' || s.status === 'SUBMITTED' ? s.status : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    }
  },
  component: Orders,
})

function Orders() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <OrderList
      search={search}
      onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
    />
  )
}
