import { useId, useMemo, useState, type ReactNode } from 'react'
import { Minus, Plus, Ruler } from 'lucide-react'
import { ActionBar, PageHead, Stepper } from '@/components/ParentPage'
import { PARENT_ACTION, PARENT_ACTION_PRIMARY } from '@/components/ParentShell'
import { SizeLabel } from '@/components/SizeLabel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Colour, Img, Kit, KitOption, LooseItem, Ordering, PublicStudent } from '../api'
import {
  clampQty,
  draftProblems,
  effectiveSlotSize,
  formatPrice,
  MAX_QTY,
  needsColourChoice,
  selectedOption,
  suggestionFor,
  type Draft,
  type ItemDraft,
  type KitDraft,
  type SlotDraft,
  type Suggestion,
} from '../choices'
import { SIZE_CHARTS } from '../sizeCharts'
import { ColourSelect } from './ColourSelect'
import { ZoomableImage } from './ZoomableImage'

const OPTION_FOCUS =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

const studentDetail = (s: PublicStudent) => `Lớp ${s.class_name} · ${s.school_name}`

function SizeChartButton({ product, selected }: { product: { code: string; name: string; sizes: string[] }; selected?: string | null }) {
  const chart = SIZE_CHARTS[product.code]
  if (!chart) return null
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 self-start px-3 text-[15px] md:px-4">
          <Ruler /> Xem bảng thông số
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-3 p-4 sm:p-6">
        <DialogTitle className="px-8 text-center text-lg text-navy">Bảng thông số {product.name}</DialogTitle>
        <DialogDescription className="text-center">Đơn vị: cm</DialogDescription>
        <table className="w-full table-fixed border-collapse text-center text-[15px] tabular-nums">
          <colgroup>
            <col className="w-[60px]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-navy">
              <th scope="col" className="pb-2 text-sm font-semibold text-muted-foreground">
                Cỡ
              </th>
              {chart.columns.map((c) => (
                <th key={c.label} scope="col" className="px-1 pb-2 align-bottom text-sm font-semibold leading-tight text-navy">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {product.sizes.map((size, i) => (
              <tr
                key={size}
                className={cn('border-b border-hairline last:border-0', size === selected && 'bg-accent font-semibold')}
              >
                <th scope="row" className="py-2">
                  <SizeLabel label={size} />
                </th>
                {chart.columns.map((c) => (
                  <td key={c.label} className="px-1 py-2">
                    {c.values[i] === undefined ? '—' : formatNumber(c.values[i], 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-center text-sm text-muted-foreground">{chart.notes}</p>
      </DialogContent>
    </Dialog>
  )
}

function QtyStepper({ name, qty, onChange }: { name: string; qty: number; onChange: (qty: number) => void }) {
  return (
    <div role="group" aria-label={`Số lượng ${name}`} className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Giảm số lượng ${name}`}
        disabled={qty <= 0}
        onClick={() => onChange(clampQty(qty - 1))}
      >
        <Minus />
      </Button>
      <output aria-live="polite" className="min-w-10 text-center text-xl font-semibold tabular-nums text-navy">
        {qty}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Tăng số lượng ${name}`}
        disabled={qty >= MAX_QTY}
        onClick={() => onChange(clampQty(qty + 1))}
      >
        <Plus />
      </Button>
    </div>
  )
}

interface SizePickerProps {
  name: string
  sizes: string[]
  value: string | null
  suggestion: Suggestion | null
  labelledBy: string
  invalid?: boolean
  onChange: (size: string) => void
}

function SizePicker({ name, sizes, value, suggestion, labelledBy, invalid = false, onChange }: SizePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      data-problem={invalid || undefined}
      className="grid grid-cols-[repeat(auto-fit,minmax(68px,1fr))] gap-2 pt-2"
    >
      {sizes.map((size) => {
        const on = value === size
        const badge = suggestion?.size === size ? suggestion : null
        return (
          <label
            key={size}
            className={cn(
              'relative flex min-h-14 cursor-pointer items-center justify-center rounded-md border px-1 py-1 text-lg font-semibold',
              OPTION_FOCUS,
              on ? 'border-2 border-navy bg-navy text-white' : cn('bg-card hover:bg-accent', invalid ? 'border-destructive' : 'border-input'),
            )}
          >
            <input type="radio" className="sr-only" name={name} value={size} checked={on} onChange={() => onChange(size)} />
            <span>Cỡ {size}</span>
            {badge ? ' ' : null}
            {badge ? (
              <span
                className={cn(
                  'absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-[18px]',
                  on ? 'border-white bg-white text-navy' : 'border-navy/30 bg-secondary text-navy',
                )}
              >
                {badge.source === 'trial' ? 'Thử vừa' : 'Gợi ý'}{' '}
                <span className="sr-only">{badge.source === 'trial' ? 'theo nhân viên đo' : 'theo bảng cỡ'}</span>
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

const FieldLabel = ({ id, children }: { id: string; children: ReactNode }) => (
  <p id={id} className="text-[15px] font-medium text-muted-foreground">
    {children}
  </p>
)

function ColourField({
  name,
  colours,
  value,
  invalid,
  onChange,
}: {
  name: string
  colours: Colour[]
  value: string | null
  invalid: boolean
  onChange: (c: string) => void
}) {
  const labelId = useId()
  if (!needsColourChoice(colours)) return null
  return (
    <div className="flex flex-col gap-2 sm:max-w-[360px]" data-problem={invalid || undefined}>
      <FieldLabel id={labelId}>Màu sắc</FieldLabel>
      <ColourSelect name={name} colours={colours} labelledBy={labelId} value={value} invalid={invalid} onChange={onChange} />
      {invalid ? (
        <p role="alert" className="text-[15px] font-medium text-destructive">
          Chọn màu
        </p>
      ) : null}
    </div>
  )
}

interface CardProps {
  title: string
  image: Img | null
  price: number | null
  qty: number
  onQty: (qty: number) => void
  children?: ReactNode
}

function Card({ title, image, price, qty, onQty, children }: CardProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-lg border border-hairline bg-white p-4 md:p-5 lg:p-6"
    >
      <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-4 md:grid-cols-[160px_minmax(0,1fr)] md:gap-x-6">
        <ZoomableImage image={image} alt={title} />
        <div className="flex min-w-0 flex-col justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 id={headingId} className="text-lg font-semibold text-navy lg:text-xl">
              {title}
            </h3>
            <p className={cn('text-[15px] tabular-nums', price == null ? 'text-muted-foreground' : 'font-medium text-navy')}>
              {formatPrice(price)}
            </p>
          </div>
          <QtyStepper name={title} qty={qty} onChange={onQty} />
        </div>
      </div>
      {qty > 0 ? <div className="flex flex-col gap-5 border-t border-hairline pt-5">{children}</div> : null}
    </section>
  )
}

interface SlotFieldsProps {
  kit: Kit
  slot: Kit['slots'][number]
  kitDraft: KitDraft
  student: PublicStudent
  attempted: boolean
  problems: Set<string>
  onChange: (patch: Partial<SlotDraft>) => void
}

function SlotFields({ kit, slot, kitDraft, student, attempted, problems, onChange }: SlotFieldsProps) {
  const draft = kitDraft.slots[slot.id]
  const option = selectedOption(slot, draft)
  const custom = draft?.size != null
  const size = effectiveSlotSize(kitDraft, draft)
  const key = `${kit.id}-${slot.id}`
  const optionId = `${key}-opt`
  const sizeId = `${key}-size`
  const invalidSize = attempted && problems.has(`slot:${slot.id}`)
  const pickOption = (o: KitOption) =>
    onChange({ productId: o.product_id, colour: o.colours.length === 1 ? o.colours[0]!.code : null })

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-hairline p-3 md:p-4">
      <legend className="px-1 text-[15px] font-semibold text-navy">
        {slot.label}
        {slot.qty > 1 ? ` ×${slot.qty}` : ''}
      </legend>
      {slot.options.length > 1 ? (
        <div className="flex flex-col gap-2">
          <FieldLabel id={optionId}>Phương án</FieldLabel>
          <div role="radiogroup" aria-labelledby={optionId} className="grid gap-2 sm:grid-cols-2">
            {slot.options.map((o) => {
              const on = draft?.productId === o.product_id
              return (
                <label
                  key={o.product_id}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
                    OPTION_FOCUS,
                    on ? 'border-2 border-navy bg-secondary font-semibold text-navy' : 'border-input bg-card hover:bg-accent',
                  )}
                >
                  <input
                    type="radio"
                    className="size-5 accent-[var(--navy)]"
                    name={optionId}
                    checked={on}
                    onChange={() => pickOption(o)}
                  />
                  <span className="min-w-0 flex-1">{o.name}</span>
                  {o.suggested ? (
                    <span className="rounded-full border border-navy/30 bg-secondary px-2 text-xs font-semibold leading-[18px] text-navy">
                      Gợi ý
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-base text-navy">{option?.name}</p>
      )}
      {option ? (
        <>
          {option.image && slot.options.length > 1 ? <ZoomableImage image={option.image} alt={option.name} className="max-w-40" /> : null}
          <ColourField
            name={`${key}-colour`}
            colours={option.colours}
            value={draft?.colour ?? null}
            invalid={attempted && problems.has(`slot-colour:${slot.id}`)}
            onChange={(colour) => onChange({ colour })}
          />
          <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-[15px]', OPTION_FOCUS)}>
            <input
              type="checkbox"
              className="size-5 accent-[var(--navy)]"
              checked={custom}
              onChange={(e) => onChange({ size: e.target.checked ? (kitDraft.size ?? '') : null })}
            />
            Chọn cỡ riêng cho món này
          </label>
          {custom ? (
            <div className="flex flex-col gap-2">
              <FieldLabel id={sizeId}>Cỡ {slot.label}</FieldLabel>
              <SizePicker
                name={sizeId}
                sizes={option.sizes}
                value={draft?.size || null}
                suggestion={suggestionFor(option, student)}
                labelledBy={sizeId}
                invalid={invalidSize}
                onChange={(next) => onChange({ size: next })}
              />
            </div>
          ) : (
            <p className="text-[15px] text-muted-foreground">
              {size ? `Dùng cỡ chung: ${size}` : 'Chọn cỡ chung ở trên'}
              {size && !option.sizes.includes(size) ? ' — phương án này không có cỡ đó' : ''}
            </p>
          )}
          {invalidSize ? (
            <p role="alert" className="text-[15px] font-medium text-destructive">
              Chọn cỡ cho {slot.label}
            </p>
          ) : null}
          <SizeChartButton product={option} selected={size} />
        </>
      ) : null}
    </fieldset>
  )
}

interface ChooseStepProps {
  s: PublicStudent
  ordering: Ordering
  draft: Draft
  onDraft: (draft: Draft) => void
  onBack: () => void
  onNext: () => void
}

export function ChooseStep({ s, ordering, draft, onDraft, onBack, onNext }: ChooseStepProps) {
  const [attempted, setAttempted] = useState(false)
  const problems = useMemo(() => new Set(draftProblems(ordering, draft)), [ordering, draft])
  const empty = problems.has('empty')

  const setKit = (id: string, patch: Partial<KitDraft>) =>
    onDraft({ ...draft, kits: { ...draft.kits, [id]: { ...draft.kits[id]!, ...patch } } })
  const setSlot = (kitId: string, slotId: string, patch: Partial<SlotDraft>) => {
    const kit = draft.kits[kitId]!
    setKit(kitId, { slots: { ...kit.slots, [slotId]: { ...kit.slots[slotId]!, ...patch } } })
  }
  const setItem = (id: string, patch: Partial<ItemDraft>) =>
    onDraft({ ...draft, items: { ...draft.items, [id]: { ...draft.items[id]!, ...patch } } })

  const next = () => {
    if (problems.size > 0) {
      setAttempted(true)
      requestAnimationFrame(() =>
        document.querySelector('[data-problem]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      )
      return
    }
    onNext()
  }

  const kitCards = ordering.kits.filter((k) => k.slots.length > 0).map((kit) => {
    const d = draft.kits[kit.id]!
    const sizeId = `kit-${kit.id}-size`
    const sizes = selectedOption(kit.slots[0]!, d.slots[kit.slots[0]!.id])?.sizes ?? kit.slots[0]?.options[0]?.sizes ?? []
    const first = selectedOption(kit.slots[0]!, d.slots[kit.slots[0]!.id])
    return (
      <Card key={kit.id} title={kit.name} image={kit.image} price={kit.price} qty={d.qty} onQty={(qty) => setKit(kit.id, { qty })}>
        <div className="flex flex-col gap-2">
          <FieldLabel id={sizeId}>Cỡ chung của bộ</FieldLabel>
          <SizePicker
            name={sizeId}
            sizes={sizes}
            value={d.size}
            suggestion={first ? suggestionFor(first, s) : null}
            labelledBy={sizeId}
            invalid={attempted && problems.has(`kit:${kit.id}`)}
            onChange={(size) => setKit(kit.id, { size })}
          />
          {attempted && problems.has(`kit:${kit.id}`) ? (
            <p role="alert" className="text-[15px] font-medium text-destructive">
              Chọn cỡ
            </p>
          ) : null}
        </div>
        {kit.slots.map((slot) => (
          <SlotFields
            key={slot.id}
            kit={kit}
            slot={slot}
            kitDraft={d}
            student={s}
            attempted={attempted}
            problems={problems}
            onChange={(patch) => setSlot(kit.id, slot.id, patch)}
          />
        ))}
      </Card>
    )
  })

  const itemCard = (item: LooseItem) => {
    const d = draft.items[item.product_id]!
    const sizeId = `item-${item.product_id}-size`
    const invalidSize = attempted && problems.has(`item:${item.product_id}`)
    return (
      <Card
        key={item.product_id}
        title={item.name}
        image={item.image}
        price={item.price}
        qty={d.qty}
        onQty={(qty) => setItem(item.product_id, { qty })}
      >
        <div className="flex flex-col gap-2">
          <FieldLabel id={sizeId}>Cỡ</FieldLabel>
          <SizePicker
            name={sizeId}
            sizes={item.sizes}
            value={d.size}
            suggestion={suggestionFor(item, s)}
            labelledBy={sizeId}
            invalid={invalidSize}
            onChange={(size) => setItem(item.product_id, { size })}
          />
          {invalidSize ? (
            <p role="alert" className="text-[15px] font-medium text-destructive">
              Chọn cỡ
            </p>
          ) : null}
        </div>
        <ColourField
          name={`item-${item.product_id}-colour`}
          colours={item.colours}
          value={d.colour}
          invalid={attempted && problems.has(`item-colour:${item.product_id}`)}
          onChange={(colour) => setItem(item.product_id, { colour })}
        />
        <SizeChartButton product={item} selected={d.size} />
      </Card>
    )
  }

  return (
    <>
      <PageHead title={s.full_name} meta={studentDetail(s)} aside={<Stepper current={2} />} />
      <div className="flex flex-col gap-8">
        {ordering.kits.length > 0 ? (
          <section aria-labelledby="kits-heading" className="flex flex-col gap-4">
            <h2 id="kits-heading" className="text-xl font-semibold text-navy">
              Bộ đồng phục
            </h2>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 lg:items-start">{kitCards}</div>
          </section>
        ) : null}
        {ordering.items.length > 0 ? (
          <section aria-labelledby="items-heading" className="flex flex-col gap-4">
            <h2 id="items-heading" className="text-xl font-semibold text-navy">
              Món lẻ
            </h2>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 lg:items-start">{ordering.items.map(itemCard)}</div>
          </section>
        ) : null}
      </div>
      <ActionBar>
        <Button variant="outline" size="lg" className={PARENT_ACTION} onClick={onBack}>
          Quay lại
        </Button>
        <Button size="lg" className={PARENT_ACTION_PRIMARY} disabled={empty} onClick={next}>
          Tiếp tục
        </Button>
      </ActionBar>
    </>
  )
}
