import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { studentsApi, type StudentIn, type StudentListParams } from './api'

export const studentKeys = {
  all: ['students'] as const,
  list: (params: StudentListParams) => [...studentKeys.all, 'list', params] as const,
  detail: (id: string) => [...studentKeys.all, 'detail', id] as const,
}

const REFETCH_MS = 30_000

export const studentsListQueryOptions = (params: StudentListParams, enabled = true) =>
  queryOptions({
    queryKey: studentKeys.list(params),
    queryFn: ({ signal }) => studentsApi.list(params, signal),
    enabled,
    refetchInterval: REFETCH_MS,
    placeholderData: keepPreviousData,
  })

export const studentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: studentKeys.detail(id),
    queryFn: ({ signal }) => studentsApi.get(id, signal),
  })

export function useStudents(params: StudentListParams, enabled = true) {
  return useQuery(studentsListQueryOptions(params, enabled))
}

export function useStudent(id: string) {
  return useQuery(studentQueryOptions(id))
}

function useInvalidateStudents() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['students'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
    ])
}

export function useCreateStudent() {
  const invalidate = useInvalidateStudents()
  return useMutation({ mutationFn: (body: StudentIn) => studentsApi.create(body), onSuccess: invalidate })
}

export function useUpdateStudent(id: string) {
  const invalidate = useInvalidateStudents()
  return useMutation({
    mutationFn: (body: StudentIn) => studentsApi.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteStudent(id: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateStudents()
  return useMutation({
    mutationFn: () => studentsApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: studentKeys.detail(id) })
      return invalidate()
    },
  })
}

export function useUnlinkParent(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => studentsApi.unlinkParent(studentId, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.all }),
  })
}
