import { createFileRoute, useRouter } from '@tanstack/react-router'
import { FacilityLoginPage } from '@/features/production/FacilityProductionPage'

export const Route = createFileRoute('/facility/login')({ component: FacilityLogin })

function FacilityLogin() {
  const router = useRouter()
  return <FacilityLoginPage onSuccess={() => router.history.push('/facility')} />
}
