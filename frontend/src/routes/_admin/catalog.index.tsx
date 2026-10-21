import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/features/catalog/components/CatalogPage'

export const Route = createFileRoute('/_admin/catalog/')({
  component: CatalogPage,
})
