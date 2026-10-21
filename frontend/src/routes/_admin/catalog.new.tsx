import { createFileRoute } from '@tanstack/react-router'
import { NewProduct } from '@/features/catalog/components/NewProduct'

export const Route = createFileRoute('/_admin/catalog/new')({
  component: NewProduct,
})
