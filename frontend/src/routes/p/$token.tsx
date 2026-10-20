import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { tokenSource } from '@/features/parent_portal/api'
import { PortalPage } from '@/features/parent_portal/components/PortalPage'

export const Route = createFileRoute('/p/$token')({
  component: Page,
})

function Page() {
  const { token } = Route.useParams()
  const source = useMemo(() => tokenSource(token), [token])
  return <PortalPage source={source} />
}
