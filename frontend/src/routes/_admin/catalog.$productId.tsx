import { createFileRoute } from '@tanstack/react-router'
import { EditProduct, type CatalogTab } from '@/features/catalog/components/EditProduct'

export const Route = createFileRoute('/_admin/catalog/$productId')({
  validateSearch: (search: Record<string, unknown>): { tab?: CatalogTab } => ({
    tab: search.tab === 'images' ? 'images' : undefined,
  }),
  component: EditProductPage,
})

function EditProductPage() {
  const { productId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EditProduct
      productId={productId}
      tab={tab ?? 'info'}
      onTabChange={(next) => void navigate({ search: { tab: next === 'images' ? 'images' : undefined }, replace: true })}
    />
  )
}
