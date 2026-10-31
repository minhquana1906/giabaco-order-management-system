import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSchools } from '@/features/catalog/hooks'
import { ApiError } from '@/lib/http'
import type { Campaign, CampaignAction } from '../api'
import { campaignErrorMessage } from '../errors'
import { useCampaignTransition, useUpdateCampaign } from '../hooks'
import { fromInputDateTime, toInputDateTime } from '../logic'

const ACTIONS: Record<
  CampaignAction,
  { label: string; done: string; title: string; description: string; from: Campaign['status'] }
> = {
  open: {
    label: 'Mở đợt',
    done: 'Đã mở đợt.',
    title: 'Mở đợt đăng ký?',
    description: 'Phụ huynh của trường sẽ thấy danh mục và đặt hàng được. Mỗi trường chỉ có một đợt đang mở.',
    from: 'DRAFT',
  },
  lock: {
    label: 'Khóa đợt',
    done: 'Đã khóa đợt.',
    title: 'Khóa đợt đăng ký?',
    description: 'Phụ huynh vẫn xem được đơn nhưng không sửa được nữa. Không thể sửa sản phẩm, giá, bộ cho đến khi mở lại.',
    from: 'OPEN',
  },
  reopen: {
    label: 'Mở lại đợt',
    done: 'Đã mở lại đợt.',
    title: 'Mở lại đợt đăng ký?',
    description: 'Phụ huynh có thể đặt và sửa đơn trở lại.',
    from: 'LOCKED',
  },
}

function TransitionButton({ campaign }: { campaign: Campaign }) {
  const [pending, setPending] = useState<CampaignAction | null>(null)
  const transition = useCampaignTransition(campaign.id)
  const [action] = (Object.entries(ACTIONS) as [CampaignAction, (typeof ACTIONS)[CampaignAction]][]).find(
    ([, a]) => a.from === campaign.status,
  )!
  const meta = ACTIONS[action]

  const confirm = () =>
    transition.mutate(action, {
      onSuccess: () => {
        setPending(null)
        toast.success(meta.done)
      },
      onError: (error) => {
        setPending(null)
        toast.error(campaignErrorMessage(error))
      },
    })

  return (
    <>
      <Button variant={action === 'lock' ? 'outline' : 'default'} onClick={() => setPending(action)}>
        {meta.label}
      </Button>
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Hủy
            </Button>
            <Button onClick={confirm} disabled={transition.isPending}>
              {meta.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function InfoTab({ campaign }: { campaign: Campaign }) {
  const schools = useSchools()
  const update = useUpdateCampaign(campaign.id)
  const [name, setName] = useState(campaign.name)
  const [schoolYear, setSchoolYear] = useState(campaign.school_year)
  const [opensAt, setOpensAt] = useState(toInputDateTime(campaign.opens_at))
  const [closesAt, setClosesAt] = useState(toInputDateTime(campaign.closes_at))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const school = schools.data?.find((s) => s.id === campaign.school_id)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    update.mutate(
      {
        name,
        school_year: schoolYear,
        opens_at: fromInputDateTime(opensAt),
        closes_at: fromInputDateTime(closesAt),
      },
      {
        onSuccess: () => toast.success('Đã lưu thông tin đợt'),
        onError: (error) => {
          if (error instanceof ApiError && error.fields) {
            const { '': general, ...byField } = error.fields
            setErrors(byField)
            if (general) toast.error(general)
          } else toast.error(campaignErrorMessage(error))
        },
      },
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className="min-w-0">
        <FormSection title="Thông tin đợt">
          <p className="text-sm text-muted-foreground">Trường: {school?.name ?? '—'}</p>
          <Field id="info-name" label="Tên đợt" error={errors.name}>
            {(control) => <Input {...control} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field id="info-year" label="Năm học" error={errors.school_year}>
            {(control) => <Input {...control} value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Field id="info-opens" label="Mở từ" error={errors.opens_at}>
              {(control) => (
                <Input {...control} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
              )}
            </Field>
            <Field id="info-closes" label="Hạn đăng ký (hiển thị cho phụ huynh)" error={errors.closes_at}>
              {(control) => (
                <Input {...control} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              )}
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">Hạn đăng ký chỉ để hiển thị, đợt không tự khóa khi hết hạn.</p>
          <div>
            <Button type="submit" disabled={update.isPending || !opensAt}>
              Lưu thông tin
            </Button>
          </div>
        </FormSection>
      </form>
      <FormSection title="Trạng thái" className="self-start">
        <p className="text-sm text-muted-foreground">
          {campaign.status === 'DRAFT' && 'Đợt nháp: phụ huynh chưa thấy. Cần ít nhất một sản phẩm để mở đợt.'}
          {campaign.status === 'OPEN' && 'Đợt đang mở: phụ huynh đặt được. Chỉ được thêm sản phẩm hoặc đổi giá.'}
          {campaign.status === 'LOCKED' && 'Đợt đã khóa: phụ huynh chỉ xem được đơn.'}
        </p>
        <div>
          <TransitionButton campaign={campaign} />
        </div>
      </FormSection>
    </div>
  )
}
