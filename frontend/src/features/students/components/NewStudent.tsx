import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import type { StudentDetail } from '../api'
import { QrCard } from './QrCard'
import { StudentForm } from './StudentForm'

const STORAGE_KEY = 'guniform.student-context'

const EMPTY_CONTEXT = { schoolId: '', classId: '' }

function loadContext(): { schoolId: string; classId: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { schoolId?: unknown; classId?: unknown } | null
    if (typeof raw?.schoolId === 'string' && typeof raw.classId === 'string') {
      return { schoolId: raw.schoolId, classId: raw.classId }
    }
  } catch {
    return EMPTY_CONTEXT
  }
  return EMPTY_CONTEXT
}

function saveContext(schoolId: string, classId: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schoolId, classId }))
}

export function NewStudent() {
  const [round, setRound] = useState(0)
  const [saved, setSaved] = useState<StudentDetail | null>(null)
  const [context] = useState(loadContext)
  const [current, setCurrent] = useState(context)

  if (saved) {
    return (
      <div className="mx-auto flex max-w-[520px] flex-col items-center gap-5 py-4 text-center">
        <div>
          <h1 className="text-[22px] font-semibold sm:text-[26px]">Đã lưu {saved.full_name}</h1>
          <p className="mt-1 text-muted-foreground">
            Lớp {saved.class.name} · {saved.school.name}
          </p>
        </div>
        <QrCard portalUrl={saved.portal_url} fileName={`qr-${saved.full_name}`} size={280} />
        <div className="flex w-full max-w-[420px] flex-col gap-2">
          <Button
            autoFocus
            size="lg"
            className="h-12 text-base"
            onClick={() => {
              setSaved(null)
              setRound((r) => r + 1)
            }}
          >
            Thêm học sinh tiếp theo
          </Button>
          <Button variant="outline" size="lg" className="h-12 text-base" asChild>
            <Link to="/students/$studentId" params={{ studentId: saved.id }}>
              Xem hồ sơ
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Thêm thông tin học sinh" />
      <StudentForm
        key={round}
        initialContext={current}
        onContextChange={(schoolId, classId) => {
          setCurrent({ schoolId, classId })
          saveContext(schoolId, classId)
        }}
        onSaved={(s) => {
          saveContext(s.school.id, s.class.id)
          setCurrent({ schoolId: s.school.id, classId: s.class.id })
          setSaved(s)
          window.scrollTo?.({ top: 0 })
        }}
      />
    </div>
  )
}
