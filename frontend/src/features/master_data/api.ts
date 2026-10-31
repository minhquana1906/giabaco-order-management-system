import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, http } from '@/lib/http'
import type { Data, Definition, Kind } from './fields'

const SAVE_ERROR_MESSAGE = 'Chưa lưu được thay đổi. Vui lòng thử lại sau ít phút.'

export type RecordItem = {
  id: string
  data: Data
  missing_fields: string[]
  linked_products?: { id: string; name: string }[]
}
export type Summary = Record<Kind, { total: number; needs_attention: number }>
export type Staff = { id: string; facility_id: string; username: string; disabled_at: string | null }
export type StaffChange = { username?: string; password?: string; disabled?: boolean }

export const useDefinitions = () =>
  useQuery({
    queryKey: ['master-data', 'definitions'],
    queryFn: () => http.get<Record<Kind, Definition>>('/master-data/definitions'),
    staleTime: Infinity,
  })

export const useSummary = () =>
  useQuery({ queryKey: ['master-data', 'summary'], queryFn: () => http.get<Summary>('/master-data/summary') })

export const useRecords = (kind: Kind) =>
  useQuery({ queryKey: ['master-data', 'list', kind], queryFn: () => http.get<RecordItem[]>(`/master-data/${kind}`) })

function useRefresh(kind: Kind) {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['master-data', 'list', kind] }),
      client.invalidateQueries({ queryKey: ['master-data', 'summary'] }),
      // The production assignment form lists partners and their active state.
      kind === 'facilities' && client.invalidateQueries({ queryKey: ['production', 'facilities'] }),
    ])
}

export function useSaveRecord(kind: Kind) {
  const refresh = useRefresh(kind)
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Data }) =>
      id
        ? http.put<RecordItem>(`/master-data/${kind}/${id}`, { data })
        : http.post<RecordItem>(`/master-data/${kind}`, { data }),
    onSuccess: refresh,
  })
}

export function useDeleteRecord(kind: Kind) {
  const refresh = useRefresh(kind)
  return useMutation({
    mutationFn: (id: string) => http.delete(`/master-data/${kind}/${id}`),
    onSuccess: refresh,
  })
}

const staffKey = (facilityId: string) => ['master-data', 'staff', facilityId]

/** Sign-in accounts of a production facility; served by the production API. */
export const useStaff = (facilityId: string) =>
  useQuery({
    queryKey: staffKey(facilityId),
    queryFn: ({ signal }) => http.get<Staff[]>(`/production/facilities/${facilityId}/staff`, undefined, signal),
  })

export function useStaffWrite<V>(facilityId: string, write: (value: V) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSuccess: () => client.invalidateQueries({ queryKey: staffKey(facilityId) }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : SAVE_ERROR_MESSAGE),
  })
}

export const staffApi = {
  create: (facilityId: string, body: { username: string; password: string }) =>
    http.post<Staff>(`/production/facilities/${facilityId}/staff`, body),
  update: (facilityId: string, staffId: string, body: StaffChange) =>
    http.patch<Staff>(`/production/facilities/${facilityId}/staff/${staffId}`, body),
}
