import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { statsApi, type PivotParams } from './api'

export const statsKeys = {
  all: ['stats'] as const,
  overview: (schoolId?: string) => [...statsKeys.all, 'overview', schoolId ?? null] as const,
  distribution: (product: string, schoolId?: string) =>
    [...statsKeys.all, 'size-distribution', product, schoolId ?? null] as const,
  campaignOverview: (campaignId: string, submittedUntil?: string) =>
    [...statsKeys.all, 'campaign-overview', campaignId, submittedUntil ?? null] as const,
  campaignPivot: (params: PivotParams) => [...statsKeys.all, 'campaign-pivot', params] as const,
  surveys: () => [...statsKeys.all, 'surveys'] as const,
  matrix: (product: string, schoolId: string) =>
    [...statsKeys.all, 'class-matrix', product, schoolId] as const,
}

const POLL_MS = 30_000

export function useOverview(schoolId: string | undefined) {
  return useQuery({
    queryKey: statsKeys.overview(schoolId),
    queryFn: ({ signal }) => statsApi.overview(schoolId, signal),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useSizeDistribution(product: string | undefined, schoolId: string | undefined) {
  return useQuery({
    queryKey: statsKeys.distribution(product ?? '', schoolId),
    queryFn: ({ signal }) => statsApi.sizeDistribution(product!, schoolId, signal),
    enabled: Boolean(product),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useClassMatrix(product: string | undefined, schoolId: string | undefined) {
  return useQuery({
    queryKey: statsKeys.matrix(product ?? '', schoolId ?? ''),
    queryFn: ({ signal }) => statsApi.classMatrix(product!, schoolId!, signal),
    enabled: Boolean(product && schoolId),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useCampaignOverview(campaignId: string | undefined, submittedUntil?: string) {
  return useQuery({
    queryKey: statsKeys.campaignOverview(campaignId ?? '', submittedUntil),
    queryFn: ({ signal }) => statsApi.campaignOverview(campaignId!, submittedUntil, signal),
    enabled: Boolean(campaignId),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useCampaignPivot(params: Omit<PivotParams, 'campaignId'> & { campaignId: string | undefined }) {
  const { campaignId, ...rest } = params
  return useQuery({
    queryKey: statsKeys.campaignPivot({ campaignId: campaignId ?? '', ...rest }),
    queryFn: ({ signal }) => statsApi.campaignPivot({ campaignId: campaignId!, ...rest }, signal),
    enabled: Boolean(campaignId),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useSurveyOverview() {
  return useQuery({
    queryKey: statsKeys.surveys(),
    queryFn: ({ signal }) => statsApi.surveyOverview(signal),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}
