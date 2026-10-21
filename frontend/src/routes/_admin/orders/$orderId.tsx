import { createFileRoute } from '@tanstack/react-router'
import { OrderDetailView } from '@/features/orders/components/OrderDetailView'

export const Route = createFileRoute('/_admin/orders/$orderId')({
  component: Order,
})

function Order() {
  const { orderId } = Route.useParams()
  return <OrderDetailView orderId={orderId} />
}
