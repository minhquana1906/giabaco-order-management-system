import { createFileRoute } from '@tanstack/react-router'
import { NewStudent } from '@/features/students/components/NewStudent'

export const Route = createFileRoute('/_admin/students/new')({
  component: NewStudent,
})
