import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogKeys } from '@/features/catalog/hooks'
import { campaignsApi, type Campaign, type CampaignAction, type CampaignInfo, type CampaignItem, type Kit } from './api'

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: (schoolId?: string) => [...campaignKeys.all, 'list', schoolId ?? null] as const,
  detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
}

export function useCampaigns(schoolId: string | undefined) {
  return useQuery({
    queryKey: campaignKeys.list(schoolId),
    queryFn: ({ signal }) => campaignsApi.list(schoolId, signal),
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: ({ signal }) => campaignsApi.get(id, signal),
  })
}

function useCampaignWrite<V>(write: (variables: V) => Promise<Campaign>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSuccess: (campaign) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), campaign)
      void queryClient.invalidateQueries({ queryKey: [...campaignKeys.all, 'list'] })
      void queryClient.invalidateQueries({ queryKey: [...catalogKeys.all, 'school-products'] })
    },
  })
}

export function useCreateCampaign() {
  return useCampaignWrite(campaignsApi.create)
}

export function useUpdateCampaign(id: string) {
  return useCampaignWrite((body: CampaignInfo) => campaignsApi.update(id, body))
}

export function useReplaceItems(id: string) {
  return useCampaignWrite((items: CampaignItem[]) => campaignsApi.replaceItems(id, items))
}

export function useReplaceKits(id: string) {
  return useCampaignWrite((kits: Kit[]) => campaignsApi.replaceKits(id, kits))
}

export function useCampaignTransition(id: string) {
  return useCampaignWrite((action: CampaignAction) => campaignsApi.transition(id, action))
}
