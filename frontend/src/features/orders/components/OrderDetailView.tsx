import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { NativeSelect } from '@/components/NativeSelect'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { campaignErrorMessage } from '@/features/campaigns/errors'
import type { TailorLine } from '@/features/parent_portal/api'
import { tailorConfig } from '@/features/parent_portal/choices'
import { TailorFields } from '@/features/parent_portal/components/ChooseStep'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { OrderDetail, OrderGender, OrderLine } from '../api'
import { usePatchOrder, useReplaceLines, useOrder } from '../hooks'
import {
  actionLabel,
  buildLinesPayload,
  describeHistory,
  effectiveSize,
  genderText,
  isDirty,
  SOURCE_LABEL,
  type SizeEdits,
} from '../logic'
import { OrderStatusBadge } from './OrderStatusBadge'

function LineRow({
  line,
  size,
  onSize,
  tailor,
  onTailor,
}: {
  line: OrderLine
  size: string
  onSize: (size: string) => void
  tailor: TailorLine
  onTailor: (patch: Partial<TailorLine>) => void
}) {
  const id = `size-${line.id}`
  const changed = size !== line.size_label
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_5rem_6.5rem_6.5rem_8rem]">
      <div className="min-w-0">
        <p className="font-medium">{line.product_name}</p>
        <p className="text-sm text-muted-foreground">
          {line.slot_label ? `${line.slot_label} · ` : ''}Màu {line.colour}
        </p>
        <TailorFields name={line.product_name} draft={tailor} config={line.product_tailor_measurements ?? []}
          invalid={false} onChange={onTailor} />
      </div>
      <p className="hidden text-right text-sm tabular-nums md:block">{line.qty}</p>
      <p className="hidden whitespace-nowrap text-right text-sm tabular-nums md:block">
        {line.unit_price == null ? <span className="text-muted-foreground">Chưa có giá</span> : formatVnd(line.unit_price)}
      </p>
      <p className="hidden whitespace-nowrap text-right text-sm font-medium tabular-nums md:block">
        {line.unit_price == null ? '—' : formatVnd(line.unit_price * line.qty)}
      </p>
      <div className="flex items-center gap-2 md:justify-end">
        <label htmlFor={id} className="sr-only">
          Cỡ {line.product_name}
        </label>
        {tailor.is_tailor ? <span>May đo</span> : (
          <NativeSelect
            id={id}
            value={size}
            onChange={(e) => onSize(e.target.value)}
            className={changed ? 'border-brass' : undefined}
          >
            {line.sizes.map((s) => (
              <option key={s} value={s}>Cỡ {s}</option>
            ))}
          </NativeSelect>
        )}
      </div>
      <p className="col-span-2 text-sm tabular-nums text-muted-foreground md:hidden">
        Số lượng {line.qty} ·{' '}
        {line.unit_price == null ? 'Chưa có giá' : `${formatVnd(line.unit_price)} · ${formatVnd(line.unit_price * line.qty)}`}
      </p>
    </li>
  )
}

function LinesSection({ order }: { order: OrderDetail }) {
  const save = useReplaceLines(order.id)
  const [edits, setEdits] = useState<SizeEdits>({})
  const [tailorEdits, setTailorEdits] = useState<Record<string, TailorLine>>({})
  const dirty = isDirty(order, edits) || Object.keys(tailorEdits).length > 0
  const invalid = order.lines.some((line) => {
    const draft = tailorEdits[line.id] ?? { ...line, line_id: line.id }
    if (!draft.is_tailor) return false
    const fields = tailorConfig(draft, line.product_tailor_measurements ?? [])
    return fields.length === 0 || fields.some((field) => {
      const value = draft.measurements?.[field.key]
      return (field.required && value == null) || (value != null && (!Number.isFinite(value) || value <= 0 || value > 500))
    })
  })
  const groups = [
    ...order.kit_lines.map((k) => ({
      key: k.id,
      title: `${k.kit_name} × ${k.qty}`,
      lines: order.lines.filter((l) => l.kit_line_id === k.id),
    })),
    { key: 'loose', title: 'Món lẻ', lines: order.lines.filter((l) => l.kit_line_id === null) },
  ].filter((g) => g.lines.length > 0)

  const run = (submit: boolean) =>
    save.mutate(buildLinesPayload(order, edits, submit, tailorEdits), {
      onSuccess: () => {
        setEdits({})
        setTailorEdits({})
        toast.success(submit ? 'Đã gửi đơn' : 'Đã lưu cỡ')
      },
      onError: (error) => toast.error(campaignErrorMessage(error)),
    })

  return (
    <section aria-labelledby="order-lines" className="flex flex-col gap-3">
      <h2 id="order-lines" className="text-lg font-semibold">
        Dòng đơn
      </h2>
      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-hairline px-4 py-8 text-center text-muted-foreground">
          Đơn chưa có dòng nào.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="overflow-hidden rounded-md border border-hairline bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 border-b border-hairline bg-muted px-3 py-2 text-sm sm:px-4 md:grid-cols-[minmax(0,1fr)_5rem_6.5rem_6.5rem_8rem]">
              <h3 className="font-semibold">{group.title}</h3>
              <span className="hidden text-right text-muted-foreground md:block">Số lượng</span>
              <span className="hidden text-right text-muted-foreground md:block">Đơn giá</span>
              <span className="hidden text-right text-muted-foreground md:block">Thành tiền</span>
              <span className="hidden text-right text-muted-foreground md:block">Cỡ</span>
            </div>
            <ul className="divide-y divide-hairline">
              {group.lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  size={effectiveSize(line, edits)}
                  onSize={(size) => setEdits((current) => ({ ...current, [line.id]: size }))}
                  tailor={tailorEdits[line.id] ?? { ...line, line_id: line.id }}
                  onTailor={(patch) => setTailorEdits((current) => ({
                    ...current,
                    [line.id]: { ...line, line_id: line.id, ...current[line.id], ...patch },
                  }))}
                />
              ))}
            </ul>
          </div>
        ))
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tổng tiền · {formatNumber(order.item_count)} món</p>
          <p className="text-2xl font-semibold tabular-nums">{formatVnd(order.total)}</p>
          {order.has_unpriced ? (
            <p className="text-sm text-muted-foreground">Một số sản phẩm chưa có giá, chưa tính vào tổng.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty ? (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => { setEdits({}); setTailorEdits({}) }} disabled={save.isPending}>
              Hoàn tác
            </Button>
          ) : null}
          <Button className="h-11 md:h-9" onClick={() => run(false)} disabled={!dirty || invalid || save.isPending}>
            Lưu cỡ
          </Button>
          {order.status === 'DRAFT' && order.lines.length > 0 ? (
            <Button variant="secondary" className="h-11 md:h-9" onClick={() => run(true)} disabled={invalid || save.isPending}>
              Gửi đơn
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function InfoSection({ order }: { order: OrderDetail }) {
  const save = usePatchOrder(order.id)
  const [classLabel, setClassLabel] = useState(order.class_label ?? '')
  const [gender, setGender] = useState<OrderGender | ''>(order.gender ?? '')
  const [note, setNote] = useState(order.note ?? '')
  const dirty =
    classLabel.trim() !== (order.class_label ?? '') || gender !== (order.gender ?? '') || note.trim() !== (order.note ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    save.mutate(
      { class_label: classLabel.trim() || null, gender: gender || null, note: note.trim() || null },
      {
        onSuccess: () => toast.success('Đã lưu thông tin đơn'),
        onError: (error) => toast.error(campaignErrorMessage(error)),
      },
    )
  }

  return (
    <section aria-labelledby="order-info" className="flex flex-col gap-3">
      <h2 id="order-info" className="text-lg font-semibold">
        Thông tin
      </h2>
      <div className="overflow-hidden rounded-md border border-hairline bg-card">
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
          {[
            ['Người nhận', order.recipient_name],
            ['Phụ huynh', order.parent_name ?? '—'],
            ['SĐT phụ huynh', order.parent_phone ?? '—'],
            ['Nguồn', SOURCE_LABEL[order.source]],
            ['Cỡ chung', order.default_size ? `Cỡ ${order.default_size}` : '—'],
            ['Gửi lúc', formatDateTime(order.submitted_at)],
          ].map(([term, value]) => (
            <div key={term}>
              <dt className="text-sm text-muted-foreground">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <form onSubmit={submit} className="grid gap-3 border-t border-hairline p-4 sm:grid-cols-2 xl:grid-cols-1 [&_label]:text-sm [&_label]:text-muted-foreground">
        <Field id="order-class" label="Lớp">
          {(control) => <Input {...control} value={classLabel} maxLength={50} onChange={(e) => setClassLabel(e.target.value)} />}
        </Field>
        <Field id="order-gender" label="Giới tính">
          {(control) => (
            <NativeSelect {...control} value={gender} onChange={(e) => setGender(e.target.value as OrderGender | '')}>
              <option value="">{genderText(null)}</option>
              <option value="MALE">{genderText('MALE')}</option>
              <option value="FEMALE">{genderText('FEMALE')}</option>
            </NativeSelect>
          )}
        </Field>
        <Field id="order-note" label="Ghi chú" className="sm:col-span-2 xl:col-span-1">
          {(control) => <Input {...control} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}
        </Field>
          <div className="sm:col-span-2 xl:col-span-1">
            <Button type="submit" className="h-11 md:h-9" disabled={!dirty || save.isPending}>
              Lưu thông tin
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}

function HistorySection({ order }: { order: OrderDetail }) {
  const names = Object.fromEntries(order.lines.map((l) => [l.product_id, l.product_name]))
  return (
    <section aria-labelledby="order-history" className="flex flex-col gap-3">
      <h2 id="order-history" className="text-lg font-semibold">
        Lịch sử thay đổi
      </h2>
      <ol className="divide-y divide-hairline rounded-md border border-hairline bg-card">
        {order.history.map((h, index) => {
          const changes = describeHistory(h, names)
          return (
            <li key={`${h.at}-${index}`} className="px-4 py-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">{actionLabel(h.action)}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatDateTime(h.at)} · {h.actor}
                </span>
              </p>
              {changes.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const query = useOrder(orderId)
  if (query.isPending) return <LoadingRows rows={6} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const order = query.data
  const version = order.updated_at

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/orders"
          search={{ campaign_id: order.campaign_id }}
          className="inline-flex min-h-10 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Đơn hàng
        </Link>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {order.recipient_name} <OrderStatusBadge status={order.status} />
            </span>
          }
        />
        <p className="font-mono text-sm text-muted-foreground">{order.code}</p>
        {order.campaign_status === 'LOCKED' ? (
          <p role="note" className="rounded-md border border-hairline bg-muted px-3 py-2 text-sm">
            Đợt đã khóa. Phụ huynh không sửa được; quản trị viên vẫn sửa được và mọi thay đổi được ghi vào lịch sử.
          </p>
        ) : null}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <LinesSection key={`lines-${version}`} order={order} />
        <div className="flex flex-col gap-6">
          <InfoSection key={`info-${version}`} order={order} />
          <HistorySection order={order} />
        </div>
      </div>
    </div>
  )
}
