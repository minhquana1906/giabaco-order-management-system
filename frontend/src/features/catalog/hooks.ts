import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { catalogApi, type ProductUpdateInput } from './api'
import { colourLookup } from './colourLogic'

export const catalogKeys = {
  all: ['catalog'] as const,
  products: () => [...catalogKeys.all, 'products'] as const,
  adminProducts: () => [...catalogKeys.all, 'admin-products'] as const,
  colours: () => [...catalogKeys.all, 'colours'] as const,
  images: (productId: string, schoolId: string) => [...catalogKeys.all, 'images', productId, schoolId] as const,
  schools: () => [...catalogKeys.all, 'schools'] as const,
  schoolProducts: (schoolId: string) => [...catalogKeys.all, 'school-products', schoolId] as const,
  classes: (schoolId: string) => [...catalogKeys.all, 'classes', schoolId] as const,
  sizeSuggestions: (heightCm: number, weightKg: number) =>
    [...catalogKeys.all, 'size-suggestions', heightCm, weightKg] as const,
}

const CATALOG_STALE_MS = 5 * 60_000

export const productsQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.products(),
    queryFn: ({ signal }) => catalogApi.products(false, signal),
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

export function useSchoolProducts(schoolId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.schoolProducts(schoolId ?? ''),
    queryFn: ({ signal }) => catalogApi.schoolProducts(schoolId!, signal),
    enabled: Boolean(schoolId),
  })
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

export function useAdminProducts() {
  return useQuery({
    queryKey: catalogKeys.adminProducts(),
    queryFn: ({ signal }) => catalogApi.products(true, signal),
  })
}

export function useColours() {
  return useQuery({
    queryKey: catalogKeys.colours(),
    queryFn: ({ signal }) => catalogApi.colours(signal),
    staleTime: Infinity,
  })
}

export function useColourLookup() {
  const { data } = useColours()
  return useMemo(() => colourLookup(data), [data])
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: catalogApi.createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ProductUpdateInput) => catalogApi.updateProduct(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useProductImages(productId: string, schoolId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.images(productId, schoolId ?? ''),
    queryFn: ({ signal }) => catalogApi.listImages(productId, schoolId!, signal),
    enabled: Boolean(schoolId),
  })
}

export function useUploadProductImage(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof catalogApi.uploadProductImage>[1]) =>
      catalogApi.uploadProductImage(productId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useDeleteProductImage(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: string) => catalogApi.deleteProductImage(productId, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}
