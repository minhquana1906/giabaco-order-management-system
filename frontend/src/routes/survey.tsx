import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SurveyPage } from '@/features/surveys/components/SurveyPage'

export const Route = createFileRoute('/survey')({
  component: Page,
})

function Page() {
  useEffect(() => {
    document.title = 'Phiếu khảo sát · G-UNIFORM'
  }, [])
  return <SurveyPage />
}
