import { createFileRoute } from '@tanstack/react-router'
import { dashboardParams, parseDashboardSearch, patchSearch, withSchool } from '@/features/stats/dashboardSearch'
import { DashboardPage } from '@/features/stats/components/DashboardPage'

export const Route = createFileRoute('/_admin/dashboard')({
  validateSearch: parseDashboardSearch,
  component: Dashboard,
})

function Dashboard() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DashboardPage
      params={dashboardParams(search)}
      onChange={(patch) => void navigate({ search: (prev) => patchSearch(prev, patch) })}
      onSchoolChange={(id) => void navigate({ search: (prev) => withSchool(prev, id) })}
    />
  )
}
