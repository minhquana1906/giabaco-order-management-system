import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCampaign } from '../hooks'
import { InfoTab } from './InfoTab'
import { ItemsTab } from './ItemsTab'
import { KitsTab } from './KitsTab'
import { StatusBadge } from './StatusBadge'

export type CampaignTab = 'info' | 'items' | 'kits'

interface CampaignPageProps {
  campaignId: string
  tab: CampaignTab
  onTabChange: (tab: CampaignTab) => void
}

export function CampaignPage({ campaignId, tab, onTabChange }: CampaignPageProps) {
  const query = useCampaign(campaignId)

  if (query.isPending) return <LoadingRows rows={6} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const campaign = query.data
  const version = campaign.updated_at

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/campaigns"
        search={{ school_id: campaign.school_id }}
        className="inline-flex min-h-10 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Đợt đăng ký
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {campaign.name} <StatusBadge status={campaign.status} />
          </span>
        }
      />
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as CampaignTab)}>
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="items">Sản phẩm &amp; giá</TabsTrigger>
          <TabsTrigger value="kits">Bộ</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <InfoTab key={version} campaign={campaign} />
        </TabsContent>
        <TabsContent value="items">
          <ItemsTab key={version} campaign={campaign} />
        </TabsContent>
        <TabsContent value="kits">
          <KitsTab key={version} campaign={campaign} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
