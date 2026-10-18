import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '@/features/stats/components/DashboardPage'

export const Route = createFileRoute('/_admin/dashboard')({
  validateSearch: (search: Record<string, unknown>): { product?: string; school_id?: string } => ({
    product: typeof search.product === 'string' ? search.product : undefined,
    school_id: typeof search.school_id === 'string' ? search.school_id : undefined,
  }),
  component: Dashboard,
})

function Dashboard() {
  const { product, school_id } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DashboardPage
      product={product}
      schoolId={school_id}
      onSchoolChange={(id) => void navigate({ search: (prev) => ({ ...prev, school_id: id }) })}
    />
  )
}
