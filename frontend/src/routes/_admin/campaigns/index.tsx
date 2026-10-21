import { createFileRoute } from '@tanstack/react-router'
import { CampaignList } from '@/features/campaigns/components/CampaignList'

export const Route = createFileRoute('/_admin/campaigns/')({
  validateSearch: (search: Record<string, unknown>): { school_id?: string } => ({
    school_id: typeof search.school_id === 'string' && search.school_id ? search.school_id : undefined,
  }),
  component: Campaigns,
})

function Campaigns() {
  const { school_id } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CampaignList
      schoolId={school_id}
      onSchoolChange={(id) => void navigate({ search: { school_id: id }, replace: true })}
    />
  )
}
