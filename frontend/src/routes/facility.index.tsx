import { createFileRoute, useRouter } from '@tanstack/react-router'
import { FacilityProductionPage } from '@/features/production/FacilityProductionPage'

export const Route = createFileRoute('/facility/')({ component: FacilityPage })

function FacilityPage() {
  const router = useRouter()
  return <FacilityProductionPage onLogout={() => router.history.push('/facility/login')} />
}
