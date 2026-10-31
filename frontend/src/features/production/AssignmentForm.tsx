import { useState } from 'react'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Assignment, AssignmentChange, Facility, StepStatus } from './api'
import { localDateTime, statusLabels, touch } from './shared'

export interface AssignmentValues { facility: string; product: string; quantity: string; deadline: string; status: StepStatus; content: string; actualAt: string }

export const emptyValues: AssignmentValues = { facility: '', product: '', quantity: '', deadline: '', status: 'pending', content: '', actualAt: '' }

export function valuesOf(a: Assignment): AssignmentValues {
  return { facility: a.facility_id ?? '', product: a.product_id ?? '', quantity: a.quantity === null ? '' : String(a.quantity), deadline: a.deadline ?? '', status: a.status, content: a.content ?? '', actualAt: localDateTime(a.actual_at) }
}

/** Only the fields the admin actually changed, so unchanged keys never re-trigger server checks. */
export function assignmentChanges(a: Assignment, v: AssignmentValues): AssignmentChange {
  const before = valuesOf(a)
  const change: AssignmentChange = {}
  if (v.facility !== before.facility) change.facility_id = v.facility
  if (v.product !== before.product) change.product_id = v.product || null
  if (v.quantity !== before.quantity) change.quantity = v.quantity ? Number(v.quantity) : null
  if (v.deadline !== before.deadline) change.deadline = v.deadline || null
  if (v.status !== before.status) change.status = v.status
  if (v.content !== before.content) change.content = v.content || null
  if (v.actualAt !== before.actualAt) change.actual_at = v.actualAt ? new Date(v.actualAt).toISOString() : null
  return change
}

interface Props {
  idPrefix: string
  facilities: Facility[]
  products: { id: string; name: string }[]
  initial?: Assignment
  /** Remaining demand per product; picking a product prefills the quantity with it. */
  suggest?: Record<string, number>
  submitLabel: string
  pending: boolean
  onSubmit: (values: AssignmentValues) => void
  onCancel?: () => void
}

export function AssignmentForm({ idPrefix, facilities, products, initial, suggest, submitLabel, pending, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(initial ? valuesOf(initial) : { ...emptyValues, facility: facilities[0]?.id ?? '' })
  const set = (patch: Partial<AssignmentValues>) => setValues({ ...values, ...patch })
  const pickProduct = (product: string) => {
    const remaining = suggest?.[product]
    set({ product, ...(suggest ? { quantity: remaining && remaining > 0 ? String(remaining) : '' } : {}) })
  }
  const missingProduct = initial?.product_id && !products.some((p) => p.id === initial.product_id)
  const unchanged = !!initial && Object.keys(assignmentChanges(initial, values)).length === 0
  return <form className="grid min-w-0 gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]" onSubmit={(e) => { e.preventDefault(); onSubmit(values) }}>
    <Field id={`${idPrefix}-facility`} label="Đối tác">{(control) => <NativeSelect {...control} required value={values.facility} onChange={(e) => set({ facility: e.target.value })}>
      {facilities.length === 0 && <option value="">Chưa có đối tác</option>}
      {facilities.map((f) => <option key={f.id} value={f.id} disabled={!f.active && f.id !== initial?.facility_id}>{f.main_stage ? `${f.name} · ${f.main_stage}` : f.name}{f.active ? '' : ' (ngừng hoạt động)'}</option>)}
    </NativeSelect>}</Field>
    <Field id={`${idPrefix}-product`} label="Sản phẩm">{(control) => <NativeSelect {...control} value={values.product} onChange={(e) => pickProduct(e.target.value)}>
      <option value="">Cả đợt</option>
      {missingProduct && <option value={initial.product_id!}>{initial.product_name}</option>}
      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </NativeSelect>}</Field>
    <Field id={`${idPrefix}-quantity`} label="Số lượng">{(control) => <Input {...control} className={touch} type="number" min="1" step="1" value={values.quantity} onChange={(e) => set({ quantity: e.target.value })} />}</Field>
    <Field id={`${idPrefix}-deadline`} label="Hạn riêng">{(control) => <Input {...control} className={touch} type="date" value={values.deadline} onChange={(e) => set({ deadline: e.target.value })} />}</Field>
    {initial && <>
      <Field id={`${idPrefix}-status`} label="Trạng thái">{(control) => <NativeSelect {...control} value={values.status} onChange={(e) => set({ status: e.target.value as StepStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
      <Field id={`${idPrefix}-actual`} label="Ngày giờ thực tế">{(control) => <Input {...control} className={touch} type="datetime-local" value={values.actualAt} onChange={(e) => set({ actualAt: e.target.value })} />}</Field>
      <Field className="sm:col-span-2" id={`${idPrefix}-content`} label="Nội dung">{(control) => <Input {...control} className={touch} maxLength={10000} value={values.content} onChange={(e) => set({ content: e.target.value })} />}</Field>
    </>}
    <div className={'flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-4'}>
      {onCancel && <Button type="button" variant="outline" className={touch} onClick={onCancel}>Hủy</Button>}
      <Button className={touch} disabled={pending || unchanged}>{submitLabel}</Button>
    </div>
  </form>
}
