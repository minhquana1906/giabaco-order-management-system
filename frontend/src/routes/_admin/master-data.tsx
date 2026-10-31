import { createFileRoute } from '@tanstack/react-router'
import { MasterDataPage } from '@/features/master_data/MasterDataPage'

export const Route = createFileRoute('/_admin/master-data')({
  component: MasterDataPage,
})
