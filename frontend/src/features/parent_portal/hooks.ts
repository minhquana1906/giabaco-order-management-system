import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/http'
import type { ChoiceChanges, PortalSource } from './api'

const portalStudentQueryOptions = (source: PortalSource) =>
  queryOptions({
    queryKey: source.key,
    queryFn: ({ signal }) => source.get(signal),
    retry: (count, error) => !(error instanceof ApiError && error.status !== 0 && error.status < 500) && count < 2,
    refetchOnWindowFocus: false,
  })

export function usePortalStudent(source: PortalSource) {
  return useQuery(portalStudentQueryOptions(source))
}

export function useSaveChoices(source: PortalSource) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: ChoiceChanges) => {
      let chosenAt: string | undefined
      for (const [code, choice] of Object.entries(changes)) {
        if (choice === undefined) await source.remove(code)
        else chosenAt = (await source.choose(code, choice)).chosen_at
      }
      return chosenAt
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: source.invalidate }),
  })
}
