import { createFileRoute } from '@tanstack/react-router'
import { CampaignPage, type CampaignTab } from '@/features/campaigns/components/CampaignPage'

const TABS: CampaignTab[] = ['info', 'items', 'kits']

export const Route = createFileRoute('/_admin/campaigns/$campaignId')({
  validateSearch: (search: Record<string, unknown>): { tab: CampaignTab } => ({
    tab: TABS.find((t) => t === search.tab) ?? 'info',
  }),
  component: Campaign,
})

function Campaign() {
  const { campaignId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CampaignPage
      campaignId={campaignId}
      tab={tab}
      onTabChange={(next) => void navigate({ search: { tab: next }, replace: true })}
    />
  )
}
