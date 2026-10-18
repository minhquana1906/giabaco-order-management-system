import { createFileRoute } from '@tanstack/react-router'
import { PortalPage } from '@/features/parent_portal/components/PortalPage'

export const Route = createFileRoute('/p/$token')({
  component: Page,
})

function Page() {
  const { token } = Route.useParams()
  return <PortalPage token={token} />
}
