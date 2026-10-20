import { Badge } from '@/components/ui/badge'
import type { DataSource } from '../api'

export function DataSourceBadge({ source }: { source: DataSource }) {
  if (source !== 'PARENT_DECLARED') return null
  return <Badge variant="outline">Phụ huynh tự khai</Badge>
}
