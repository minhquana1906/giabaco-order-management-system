import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { statsApi } from './api'

export const statsKeys = {
  all: ['stats'] as const,
  overview: (schoolId?: string) => [...statsKeys.all, 'overview', schoolId ?? null] as const,
  distribution: (product: string, schoolId?: string) =>
    [...statsKeys.all, 'size-distribution', product, schoolId ?? null] as const,
  orders: (schoolId?: string) => [...statsKeys.all, 'orders', schoolId ?? null] as const,
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

export function useOrders(schoolId: string | undefined) {
  return useQuery({
    queryKey: statsKeys.orders(schoolId),
    queryFn: ({ signal }) => statsApi.orders(schoolId, signal),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  })
}
