import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi } from './api'

export const catalogKeys = {
  all: ['catalog'] as const,
  products: () => [...catalogKeys.all, 'products'] as const,
  schools: () => [...catalogKeys.all, 'schools'] as const,
  classes: (schoolId: string) => [...catalogKeys.all, 'classes', schoolId] as const,
  sizeSuggestions: (heightCm: number, weightKg: number) =>
    [...catalogKeys.all, 'size-suggestions', heightCm, weightKg] as const,
}

const CATALOG_STALE_MS = 5 * 60_000

export const productsQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.products(),
    queryFn: ({ signal }) => catalogApi.products(signal),
    staleTime: CATALOG_STALE_MS,
  })

export const schoolsQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.schools(),
    queryFn: ({ signal }) => catalogApi.schools(signal),
    staleTime: CATALOG_STALE_MS,
  })

export const classesQueryOptions = (schoolId: string) =>
  queryOptions({
    queryKey: catalogKeys.classes(schoolId),
    queryFn: ({ signal }) => catalogApi.classes(schoolId, signal),
    staleTime: CATALOG_STALE_MS,
  })

export function useProducts() {
  return useQuery(productsQueryOptions())
}

export function useSchools() {
  return useQuery(schoolsQueryOptions())
}

export function useClasses(schoolId: string | undefined) {
  return useQuery({
    ...classesQueryOptions(schoolId ?? ''),
    enabled: Boolean(schoolId),
  })
}

export function useCreateSchool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: catalogApi.createSchool,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.schools() }),
  })
}

export function useCreateClass(schoolId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { grade: number; name: string }) => catalogApi.createClass(schoolId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.classes(schoolId) }),
  })
}

export function useUpdateSchool(schoolId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) => catalogApi.updateSchool(schoolId, body),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useUpdateClass(schoolId: string, classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { grade: number; name: string }) =>
      catalogApi.updateClass(schoolId, classId, body),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useSizeSuggestions(heightCm: number | null, weightKg: number | null) {
  const ready = heightCm !== null && weightKg !== null
  return useQuery({
    queryKey: catalogKeys.sizeSuggestions(heightCm ?? 0, weightKg ?? 0),
    queryFn: ({ signal }) =>
      catalogApi.sizeSuggestions({ height_cm: heightCm!, weight_kg: weightKg! }, signal),
    enabled: ready,
    staleTime: CATALOG_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
