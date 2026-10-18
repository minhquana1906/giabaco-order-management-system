import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/http'
import { portalApi } from './api'

export const portalKeys = {
  student: (token: string) => ['public-student', token] as const,
}

export const publicStudentQueryOptions = (token: string) =>
  queryOptions({
    queryKey: portalKeys.student(token),
    queryFn: ({ signal }) => portalApi.get(token, signal),
    retry: (count, error) => !(error instanceof ApiError && error.status !== 0 && error.status < 500) && count < 2,
    refetchOnWindowFocus: false,
  })

export function usePublicStudent(token: string) {
  return useQuery(publicStudentQueryOptions(token))
}

export type ChoiceChanges = Record<string, string | undefined>

export function useSaveChoices(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: ChoiceChanges) => {
      let chosenAt: string | undefined
      for (const [code, size] of Object.entries(changes)) {
        if (size === undefined) await portalApi.remove(token, code)
        else chosenAt = (await portalApi.choose(token, code, size)).chosen_at
      }
      return chosenAt
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: portalKeys.student(token) }),
  })
}
