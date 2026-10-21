import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersApi, type LinesPayload, type OrderDetail, type OrderListParams, type OrderPatch } from './api'

export const orderKeys = {
  all: ['orders'] as const,
  list: (campaignId: string, params: OrderListParams) => [...orderKeys.all, 'list', campaignId, params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
}

export function useOrders(campaignId: string | undefined, params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(campaignId ?? '', params),
    queryFn: ({ signal }) => ordersApi.list(campaignId!, params, signal),
    enabled: Boolean(campaignId),
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => ordersApi.get(id, signal),
  })
}

function useOrderWrite<V>(id: string, write: (variables: V) => Promise<OrderDetail>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(id), order)
      void queryClient.invalidateQueries({ queryKey: [...orderKeys.all, 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useReplaceLines(id: string) {
  return useOrderWrite(id, (body: LinesPayload) => ordersApi.replaceLines(id, body))
}

export function usePatchOrder(id: string) {
  return useOrderWrite(id, (body: OrderPatch) => ordersApi.patch(id, body))
}
