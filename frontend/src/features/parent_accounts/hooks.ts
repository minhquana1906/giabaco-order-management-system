import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError } from '@/lib/http'
import { pathSource } from '@/features/parent_portal/api'
import { parentAuthApi, parentChildrenApi, type ChildKey, type DeclaredBody, type CreateChildBody, type ParentAccount } from './api'

export const parentKeys = {
  all: ['parent'] as const,
  me: () => [...parentKeys.all, 'me'] as const,
  children: () => [...parentKeys.all, 'children'] as const,
  child: (studentId: string) => [...parentKeys.children(), studentId] as const,
  schools: () => [...parentKeys.all, 'schools'] as const,
  classes: (schoolId: string) => [...parentKeys.all, 'classes', schoolId] as const,
}

export const parentMeQueryOptions = () =>
  queryOptions({ queryKey: parentKeys.me(), queryFn: parentAuthApi.me, staleTime: 60_000, retry: false })

export function useParentMe() {
  return useQuery(parentMeQueryOptions())
}

async function confirmSession(queryClient: QueryClient): Promise<ParentAccount> {
  try {
    return await queryClient.fetchQuery({ ...parentMeQueryOptions(), staleTime: 0 })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, 'session_not_stored', error.message)
    }
    throw error
  }
}

export function useParentLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Parameters<typeof parentAuthApi.login>[0]) => {
      await parentAuthApi.login(body)
      return confirmSession(queryClient)
    },
  })
}

export function useParentRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Parameters<typeof parentAuthApi.register>[0]) => {
      await parentAuthApi.register(body)
      return confirmSession(queryClient)
    },
  })
}

export function useParentLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: parentAuthApi.logout,
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: parentKeys.all })
      await navigate({ to: '/parent/login', search: {} })
    },
  })
}

export const childPortalSource = (studentId: string) =>
  pathSource(`/parent/children/${encodeURIComponent(studentId)}`, parentKeys.child(studentId), parentKeys.children())

const CATALOG_STALE_MS = 5 * 60_000

export function useChildren() {
  return useQuery({
    queryKey: parentKeys.children(),
    queryFn: ({ signal }) => parentChildrenApi.list(signal),
  })
}

export function useParentSchools() {
  return useQuery({
    queryKey: parentKeys.schools(),
    queryFn: ({ signal }) => parentChildrenApi.schools(signal),
    staleTime: CATALOG_STALE_MS,
  })
}

export function useParentClasses(schoolId: string | undefined) {
  return useQuery({
    queryKey: parentKeys.classes(schoolId ?? ''),
    queryFn: ({ signal }) => parentChildrenApi.classes(schoolId!, signal),
    enabled: Boolean(schoolId),
    staleTime: CATALOG_STALE_MS,
  })
}

export function useLookupChild() {
  return useMutation({ mutationFn: (body: ChildKey) => parentChildrenApi.lookup(body) })
}

export function useClaimChild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ChildKey) => parentChildrenApi.claim(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: parentKeys.children() }),
  })
}

export function useCreateChild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateChildBody) => parentChildrenApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: parentKeys.children() }),
  })
}

export function useUpdateChild(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: DeclaredBody) => parentChildrenApi.update(studentId, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: parentKeys.children() }),
  })
}
