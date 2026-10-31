import { Badge } from '@/components/ui/badge'
import type { CampaignStatus } from '../api'
import { STATUS_LABEL } from '../logic'

const VARIANT = { DRAFT: 'secondary', OPEN: 'info', LOCKED: 'outline' } as const

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
