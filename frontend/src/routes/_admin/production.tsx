import { createFileRoute } from '@tanstack/react-router'
import { AdminProductionPage } from '@/features/production/AdminProductionPage'

export const Route = createFileRoute('/_admin/production')({
  component: AdminProductionPage,
})
