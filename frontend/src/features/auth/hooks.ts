import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from './api'

export const authKeys = {
  me: () => ['auth', 'me'] as const,
}

export const meQueryOptions = () =>
  queryOptions({ queryKey: authKeys.me(), queryFn: authApi.me, staleTime: 60_000, retry: false })

export function useMe() {
  return useQuery(meQueryOptions())
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.me(), session)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: async () => {
      queryClient.clear()
      await navigate({ to: '/login', search: {} })
    },
  })
}
