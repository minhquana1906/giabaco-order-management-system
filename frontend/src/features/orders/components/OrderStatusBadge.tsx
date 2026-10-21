import { Badge } from '@/components/ui/badge'
import type { OrderStatus } from '../api'
import { STATUS_LABEL } from '../logic'

const VARIANT = { DRAFT: 'secondary', SUBMITTED: 'default' } as const

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
