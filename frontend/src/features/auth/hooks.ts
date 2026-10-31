import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError } from '@/lib/http'
import { authApi } from './api'

export const SESSION_NOT_STORED_MESSAGE =
  'Trình duyệt đang chặn lưu đăng nhập. Mở lại trang bằng địa chỉ bắt đầu bằng https:// (không mở trong ứng dụng khác) rồi thử lại.'

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
    mutationFn: async (credentials: { username: string; password: string }) => {
      await authApi.login(credentials)
      try {
        return await queryClient.fetchQuery({ ...meQueryOptions(), staleTime: 0 })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          throw new ApiError(401, 'session_not_stored', SESSION_NOT_STORED_MESSAGE)
        }
        throw error
      }
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
