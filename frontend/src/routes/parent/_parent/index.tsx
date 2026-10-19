import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChildrenList } from '@/features/parent_accounts/components/ChildrenList'

export const Route = createFileRoute('/parent/_parent/')({
  component: Page,
})

function Page() {
  useEffect(() => {
    document.title = 'Các con của bạn · G-UNIFORM'
  }, [])
  return <ChildrenList />
}
