import { createFileRoute } from '@tanstack/react-router'
import { SchoolsPage } from '@/features/students/components/SchoolsPage'

export const Route = createFileRoute('/_admin/settings/schools')({
  component: SchoolsPage,
})
