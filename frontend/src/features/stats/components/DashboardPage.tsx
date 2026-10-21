import type { ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSchoolProducts, useSchools } from '@/features/catalog/hooks'
import { defaultSchool } from '@/features/catalog/schoolLogic'
import type { DashboardParams, DashboardView } from '../dashboardSearch'
import { useOverview } from '../hooks'
import { AccuracyCard } from './AccuracyCard'
import { ClassMatrixCard } from './ClassMatrixCard'
import { DistributionCard } from './DistributionCard'
import { KpiRow } from './KpiRow'
import { NoProfileState } from './NoProfileState'
import { OrdersTab, type SearchPatch } from './OrdersTab'
import { ProductSelect } from './ProductSelect'
import { ViewSwitch } from './ViewSwitch'

const DASHBOARD_VIEWS = [
  { value: 'measure', label: 'Số đo' },
  { value: 'orders', label: 'Đơn hàng' },
] as const satisfies readonly { value: DashboardView; label: string }[]

interface DashboardPageProps {
  params: DashboardParams
  onChange: (patch: SearchPatch) => void
  onSchoolChange: (schoolId: string) => void
}

function Frame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      {children}
    </div>
  )
}

export function DashboardPage({ params, onChange, onSchoolChange }: DashboardPageProps) {
  const schools = useSchools()
  const school = schools.data?.find((s) => s.id === params.schoolId) ?? defaultSchool(schools.data ?? [])
  const profile = useSchoolProducts(school?.id)

  const header = (
    <PageHeader
      title="Thống kê"
      actions={
        <>
          {schools.data && schools.data.length > 0 ? (
            <Select value={school?.id} onValueChange={onSchoolChange}>
              <SelectTrigger aria-label="Trường" className="w-full min-w-0 sm:w-[290px] max-sm:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schools.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <ViewSwitch
            value={params.view}
            onChange={(view) => onChange({ view })}
            options={DASHBOARD_VIEWS}
            label="Loại thống kê"
          />
        </>
      }
    />
  )

  if (schools.isPending) return <Frame header={header}><LoadingRows rows={6} /></Frame>
  if (schools.isError) {
    return (
      <Frame header={header}>
        <ErrorState error={schools.error} onRetry={() => void schools.refetch()} />
      </Frame>
    )
  }
  if (!school) {
    return (
      <Frame header={header}>
        <EmptyState title="Chưa có trường" description="Thêm trường và lớp khi thêm học sinh đầu tiên." />
      </Frame>
    )
  }
  if (profile.isPending) return <Frame header={header}><LoadingRows rows={6} /></Frame>
  if (profile.isError) {
    return (
      <Frame header={header}>
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </Frame>
    )
  }

  if (params.view === 'orders') {
    return (
      <Frame header={header}>
        <OrdersTab schoolId={school.id} params={params} products={profile.data} onChange={onChange} />
      </Frame>
    )
  }
  if (profile.data.length === 0) {
    return (
      <Frame header={header}>
        <NoProfileState schoolId={school.id} />
      </Frame>
    )
  }
  const product = profile.data.find((p) => p.code === params.product) ?? profile.data[0]!
  return (
    <Frame header={header}>
      <MeasureView
        schoolId={school.id}
        products={profile.data}
        product={product}
        onProductChange={(code) => onChange({ product: code })}
      />
    </Frame>
  )
}

interface MeasureViewProps {
  schoolId: string
  products: { code: string; name: string }[]
  product: { code: string; name: string }
  onProductChange: (code: string) => void
}

function MeasureView({ schoolId, products, product, onProductChange }: MeasureViewProps) {
  const overview = useOverview(schoolId)
  const accuracy = overview.data?.size_guide_accuracy.find((a) => a.product_code === product.code)

  return (
    <>
      {overview.isPending ? (
        <LoadingRows rows={2} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <KpiRow overview={overview.data} />
      )}
      {products.length > 1 ? <ProductSelect products={products} value={product.code} onChange={onProductChange} /> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <DistributionCard product={product.code} productName={product.name} schoolId={schoolId} />
        {overview.data ? <AccuracyCard productName={product.name} accuracy={accuracy} /> : null}
      </div>
      <ClassMatrixCard product={product.code} productName={product.name} schoolId={schoolId} />
    </>
  )
}
