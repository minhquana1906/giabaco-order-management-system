import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EditChild } from '@/features/parent_accounts/components/EditChild'
import { childPortalSource } from '@/features/parent_accounts/hooks'
import { PortalPage } from '@/features/parent_portal/components/PortalPage'
import { usePortalStudent } from '@/features/parent_portal/hooks'

export const Route = createFileRoute('/parent/_parent/children/$studentId')({
  component: Page,
})

function Page() {
  const { studentId } = Route.useParams()
  const navigate = useNavigate()
  const source = useMemo(() => childPortalSource(studentId), [studentId])
  const student = usePortalStudent(source)
  const [editing, setEditing] = useState(false)
  const [locked, setLocked] = useState(false)

  if (editing && student.data) {
    return (
      <EditChild
        studentId={studentId}
        student={student.data}
        onClose={() => setEditing(false)}
        onLocked={() => {
          setLocked(true)
          setEditing(false)
        }}
      />
    )
  }
  return (
    <PortalPage
      source={source}
      skipIdentity
      onBack={() => void navigate({ to: '/parent' })}
      onEdit={locked ? undefined : () => setEditing(true)}
    />
  )
}
