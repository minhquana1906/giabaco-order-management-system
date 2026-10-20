import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts, useSchools } from '@/features/catalog/hooks'
import { useOverview } from '../hooks'
import { AccuracyCard } from './AccuracyCard'
import { ClassMatrixCard } from './ClassMatrixCard'
import { DistributionCard } from './DistributionCard'
import { KpiRow } from './KpiRow'
import { OrdersCard } from './OrdersCard'

interface DashboardPageProps {
  product?: string
  schoolId?: string
  onSchoolChange: (schoolId: string) => void
}

export function DashboardPage({ product, schoolId, onSchoolChange }: DashboardPageProps) {
  const products = useProducts()
  const schools = useSchools()

  const school = schools.data?.find((s) => s.id === schoolId) ?? schools.data?.[0]
  const activeProduct = products.data?.find((p) => p.code === product) ?? products.data?.[0]
  const overview = useOverview(schools.isSuccess ? school?.id : undefined)

  const header = (
    <PageHeader
      title="Thống kê"
      actions={
        schools.data && schools.data.length > 0 ? (
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
        ) : undefined
      }
    />
  )

  if (products.isPending || schools.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <LoadingRows rows={6} />
      </div>
    )
  }

  const failure = products.error ?? schools.error
  if (failure) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          error={failure}
          onRetry={() => {
            void products.refetch()
            void schools.refetch()
          }}
        />
      </div>
    )
  }

  if (!activeProduct) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="Chưa có sản phẩm" description="Danh mục sản phẩm đang trống." />
      </div>
    )
  }

  const accuracy = overview.data?.size_guide_accuracy.find((a) => a.product_code === activeProduct.code)

  return (
    <div className="flex flex-col gap-4">
      {header}
      {overview.isPending ? (
        <LoadingRows rows={2} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <KpiRow overview={overview.data} />
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <DistributionCard product={activeProduct.code} productName={activeProduct.name} schoolId={school?.id} />
        {overview.data ? <AccuracyCard productName={activeProduct.name} accuracy={accuracy} /> : null}
      </div>
      <OrdersCard schoolId={school?.id} />
      <ClassMatrixCard product={activeProduct.code} productName={activeProduct.name} schoolId={school?.id} />
    </div>
  )
}
