import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { School } from '@/features/catalog/api'
import { ApiError } from '@/lib/http'
import { campaignErrorMessage } from '../errors'
import { useCreateCampaign } from '../hooks'
import { defaultSchoolYear } from '../logic'

export function CreateCampaignDialog({ schools, defaultSchoolId }: { schools: School[]; defaultSchoolId?: string }) {
  const [open, setOpen] = useState(false)
  const [schoolId, setSchoolId] = useState(defaultSchoolId ?? schools[0]?.id ?? '')
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear())
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateCampaign()
  const navigate = useNavigate()
  const school = schools.find((s) => s.id === schoolId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim() || `${school?.name ?? ''} ${schoolYear}`.trim()
    create.mutate(
      { school_id: schoolId, name: trimmed, school_year: schoolYear.trim(), opens_at: null, closes_at: null },
      {
        onSuccess: (campaign) => {
          setOpen(false)
          void navigate({ to: '/campaigns/$campaignId', params: { campaignId: campaign.id }, search: { tab: 'info' } })
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fields) setErrors(error.fields)
          else toast.error(campaignErrorMessage(error))
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setSchoolId(defaultSchoolId ?? schools[0]?.id ?? '')
          setErrors({})
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9" disabled={schools.length === 0}>
          <Plus /> Tạo đợt đăng ký
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Tạo đợt đăng ký</DialogTitle>
            <DialogDescription>Đợt mới ở trạng thái nháp. Thêm sản phẩm và bộ rồi mới mở đợt.</DialogDescription>
          </DialogHeader>
          <Field id="campaign-school" label="Trường">
            {(control) => (
              <NativeSelect {...control} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field id="campaign-year" label="Năm học" error={errors.school_year}>
            {(control) => (
              <Input {...control} value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="2026-2027" />
            )}
          </Field>
          <Field id="campaign-name" label="Tên đợt" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${school?.name ?? 'Trường'} ${schoolYear}`}
              />
            )}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !schoolId}>
              Tạo đợt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
