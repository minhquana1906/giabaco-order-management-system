import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/http'
import type { OrderLines, PortalSource } from './api'

const retry = (count: number, error: unknown) =>
  !(error instanceof ApiError && error.status !== 0 && error.status < 500) && count < 2

const portalStudentQueryOptions = (source: PortalSource) =>
  queryOptions({
    queryKey: source.key,
    queryFn: ({ signal }) => source.get(signal),
    retry,
    refetchOnWindowFocus: false,
  })

export function usePortalStudent(source: PortalSource) {
  return useQuery(portalStudentQueryOptions(source))
}

export function useOrdering(source: PortalSource) {
  return useQuery({
    queryKey: source.orderingKey,
    queryFn: ({ signal }) => source.getOrdering(signal),
    retry,
    refetchOnWindowFocus: false,
  })
}

export function useSaveOrder(source: PortalSource) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lines: OrderLines) => source.saveOrder(lines),
    onSuccess: (ordering) => queryClient.setQueryData(source.orderingKey, ordering),
    onSettled: () => queryClient.invalidateQueries({ queryKey: source.invalidate }),
  })
}
