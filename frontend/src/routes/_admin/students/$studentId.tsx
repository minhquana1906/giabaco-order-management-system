import { createFileRoute } from '@tanstack/react-router'
import { StudentDetailView } from '@/features/students/components/StudentDetailView'

export const Route = createFileRoute('/_admin/students/$studentId')({
  component: StudentDetailPage,
})

function StudentDetailPage() {
  const { studentId } = Route.useParams()
  return <StudentDetailView studentId={studentId} />
}
