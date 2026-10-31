import { useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClasses, useSchools } from '@/features/catalog/hooks'
import type { School, SchoolClass } from '@/features/catalog/api'
import { ClassPopover, SchoolPopover } from './ContextStrip'
import { Field } from './Field'

function GradeTiles({ schoolId, classes, active }: { schoolId: string; classes: SchoolClass[]; active: string }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {classes.filter((cls) => String(cls.grade) === active).map((cls) => (
        <li
          key={cls.id}
          className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-hairline bg-card py-1.5 pl-4 pr-2"
        >
          <p className="min-w-0 break-words text-base font-semibold text-foreground">{cls.name}</p>
          <ClassPopover schoolId={schoolId} grade={String(cls.grade)} cls={cls} />
        </li>
      ))}
    </ul>
  )
}

function ClassesSection({ school }: { school: School }) {
  const classes = useClasses(school.id)
  const [picked, setPicked] = useState('')
  const list = classes.data ?? []
  const grades = [...new Set(list.map((cls) => cls.grade))].sort((a, b) => a - b)
  const active = grades.map(String).includes(picked) ? picked : String(grades[0] ?? '')

  return (
    <section className="flex flex-col gap-4 border-t border-hairline pt-6" aria-labelledby="classes-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="classes-heading" className="text-lg font-semibold">Danh sách lớp</h2>
        <ClassPopover schoolId={school.id} grade={active} />
      </div>
      {classes.isPending ? <LoadingRows rows={3} /> : classes.isError ? (
        <ErrorState error={classes.error} onRetry={() => void classes.refetch()} />
      ) : grades.length === 0 ? (
        <p className="text-sm text-muted-foreground">Trường này chưa có lớp nào.</p>
      ) : (
        <Tabs value={active} onValueChange={setPicked} className="gap-5">
          <TabsList aria-label="Khối">
            {grades.map((grade) => (
              <TabsTrigger key={grade} value={String(grade)}>
                Khối {grade}
                <TabsCount>{list.filter((cls) => cls.grade === grade).length}</TabsCount>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={active}>
            <GradeTiles schoolId={school.id} classes={list} active={active} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}

export function SchoolsPage() {
  const schools = useSchools()
  const [selectedId, setSelectedId] = useState('')
  const school = schools.data?.find((item) => item.id === selectedId) ?? schools.data?.[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Trường và lớp" actions={<SchoolPopover onSaved={setSelectedId} />} />
      {schools.isPending ? <LoadingRows rows={4} /> : schools.isError ? (
        <ErrorState error={schools.error} onRetry={() => void schools.refetch()} />
      ) : !school ? (
        <p className="text-sm text-muted-foreground">Chưa có trường nào. Thêm trường để quản lý lớp.</p>
      ) : (
        <>
          <div className="max-w-md">
            <Field label="Trường" htmlFor="settings-school">
              <div className="flex items-center gap-2">
                <NativeSelect id="settings-school" value={school.id} onChange={(event) => setSelectedId(event.target.value)}>
                  {schools.data?.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </NativeSelect>
                <SchoolPopover school={school} />
              </div>
            </Field>
          </div>
          <ClassesSection key={school.id} school={school} />
        </>
      )}
    </div>
  )
}
