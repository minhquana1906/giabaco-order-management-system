import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AddChild } from '@/features/parent_accounts/components/AddChild'

export const Route = createFileRoute('/parent/_parent/children/new')({
  component: Page,
})

function Page() {
  useEffect(() => {
    document.title = 'Thêm con · G-UNIFORM'
  }, [])
  return <AddChild />
}
