import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useProducts } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'
import type { Campaign, Kit, KitSlot } from '../api'
import { campaignErrorMessage } from '../errors'
import { useReplaceKits } from '../hooks'
import { PRICE_PENDING, emptyKit, kitPrice, suggestOption, uniqueKitCode } from '../logic'
import { formatVnd } from '@/lib/format'
import { LockedNotice } from './LockedNotice'

type PreviewGender = 'MALE' | 'FEMALE' | null

const toKits = (campaign: Campaign): Kit[] =>
  campaign.kits.map(({ code, name, slots }) => ({
    code,
    name,
    slots: slots.map(({ label, qty, product_ids }) => ({ label, qty, product_ids })),
  }))

function KitPreview({
  kit,
  prices,
  genders,
  names,
  gender,
}: {
  kit: Kit
  prices: Record<string, number | null>
  genders: Record<string, string>
  names: Record<string, string>
  gender: PreviewGender
}) {
  const [chosen, setChosen] = useState<Record<number, string>>({})
  const selection = kit.slots
    .map((slot, index) => {
      const pick = chosen[index]
      const productId = pick && slot.product_ids.includes(pick) ? pick : suggestOption(slot.product_ids, genders, gender)
      return { slot, index, productId }
    })
    .filter((s) => s.productId)
  const complete = selection.length === kit.slots.length
  const total = complete ? kitPrice(selection.map((s) => ({ qty: s.slot.qty, productId: s.productId })), prices) : null

  return (
    <div className="rounded-md bg-muted px-3 py-2.5 text-sm">
      <p className="mb-1.5 font-medium">Xem trước giá bộ</p>
      <ul className="flex flex-col gap-1.5">
        {selection.map(({ slot, index, productId }) => (
          <li key={index} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-muted-foreground">
                {slot.label || 'Món'} × {slot.qty}
              </span>
              {slot.product_ids.length > 1 ? (
                <NativeSelect
                  className="h-9 md:h-9"
                  value={productId}
                  aria-label={`Phương án cho ${slot.label || 'món'}`}
                  onChange={(e) => setChosen((c) => ({ ...c, [index]: e.target.value }))}
                >
                  {slot.product_ids.map((id) => (
                    <option key={id} value={id}>
                      {names[id] ?? 'Sản phẩm'}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <span className="truncate">{names[productId] ?? 'Sản phẩm'}</span>
              )}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {prices[productId] == null ? PRICE_PENDING : formatVnd(prices[productId] * slot.qty)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-hairline pt-2 font-semibold">
        <span>Giá bộ</span>
        <span className="tabular-nums">{complete && total != null ? formatVnd(total) : complete ? PRICE_PENDING : '—'}</span>
      </p>
    </div>
  )
}

export function KitsTab({ campaign }: { campaign: Campaign }) {
  const products = useProducts()
  const save = useReplaceKits(campaign.id)
  const [kits, setKits] = useState(() => toKits(campaign))
  const [gender, setGender] = useState<PreviewGender>(null)
  const locked = campaign.status === 'LOCKED'
  const savedCodes = new Set(campaign.kits.map((k) => k.code))
  const names = Object.fromEntries((products.data ?? []).map((p) => [p.id, p.name]))
  const genders = Object.fromEntries((products.data ?? []).map((p) => [p.id, p.gender_target]))
  const prices = Object.fromEntries(campaign.items.map((i) => [i.product_id, i.unit_price]))
  const dirty = JSON.stringify(kits) !== JSON.stringify(toKits(campaign))

  const patchKit = (index: number, change: (kit: Kit) => Kit) =>
    setKits((current) => current.map((k, i) => (i === index ? change(k) : k)))
  const patchSlot = (kitIndex: number, slotIndex: number, change: Partial<KitSlot>) =>
    patchKit(kitIndex, (kit) => ({
      ...kit,
      slots: kit.slots.map((s, i) => (i === slotIndex ? { ...s, ...change } : s)),
    }))
  const withCodes = () => {
    const taken = kits.filter((k) => savedCodes.has(k.code)).map((k) => k.code)
    return kits.map((kit) => {
      if (savedCodes.has(kit.code)) return kit
      const code = uniqueKitCode(kit.name, taken)
      taken.push(code)
      return { ...kit, code }
    })
  }

  const submit = () =>
    save.mutate(withCodes(), {
      onSuccess: () => toast.success('Đã lưu bộ'),
      onError: (error) => toast.error(campaignErrorMessage(error)),
    })

  if (campaign.items.length === 0) {
    return (
      <EmptyState
        title="Chưa có sản phẩm trong đợt"
        description="Thêm sản phẩm ở mục “Sản phẩm và giá” trước, rồi quay lại định nghĩa bộ."
        className="rounded-md border border-dashed border-hairline"
      />
    )
  }

  const itemOptions = campaign.items.map((i) => i.product_id)
  const invalid = kits.some((k) => !k.name.trim() || k.slots.some((s) => !s.label.trim() || s.product_ids.length === 0))

  return (
    <div className="flex flex-col gap-4">
      <LockedNotice status={campaign.status} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span id="preview-gender-label">Xem trước cho</span>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="preview-gender-label"
            value={gender ?? ''}
            onValueChange={(v) => setGender(v === 'MALE' || v === 'FEMALE' ? v : null)}
          >
            <ToggleGroupItem value="MALE" className="px-4 max-md:min-h-11">Nam</ToggleGroupItem>
            <ToggleGroupItem value="FEMALE" className="px-4 max-md:min-h-11">Nữ</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => setKits((current) => [...current, emptyKit(current.map((k) => k.code))])}
        >
          <Plus /> Thêm bộ
        </Button>
      </div>

      {kits.length === 0 ? (
        <EmptyState
          title="Chưa có bộ nào"
          description="Bộ gồm các món (ví dụ Áo, Quần/Váy), mỗi món có một hoặc nhiều phương án sản phẩm."
          className="rounded-md border border-dashed border-hairline"
        />
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
        {kits.map((kit, kitIndex) => (
          <section key={kit.code} className="flex min-w-0 flex-col gap-3 rounded-md border border-hairline bg-card p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground">
                Tên bộ
                <Input
                  value={kit.name}
                  disabled={locked}
                  placeholder="Ví dụ: Bộ hè"
                  onChange={(e) => patchKit(kitIndex, (k) => ({ ...k, name: e.target.value }))}
                />
              </label>
              <Button
                variant="ghost"
                size="icon-lg"
                disabled={locked}
                aria-label={`Xóa bộ ${kit.name || kit.code}`}
                onClick={() => setKits((current) => current.filter((_, i) => i !== kitIndex))}
              >
                <Trash2 />
              </Button>
            </div>
            {kit.slots.map((slot, slotIndex) => (
              <fieldset key={slotIndex} className="flex flex-col gap-2 rounded-md border border-hairline p-3">
                <legend className="px-1 text-sm font-medium">Món {slotIndex + 1}</legend>
                <div className="flex items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground">
                    Tên món
                    <Input
                      value={slot.label}
                      disabled={locked}
                      placeholder="Ví dụ: Quần/Váy"
                      onChange={(e) => patchSlot(kitIndex, slotIndex, { label: e.target.value })}
                    />
                  </label>
                  <label className="flex w-20 flex-col gap-1 text-sm text-muted-foreground">
                    Số lượng
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={slot.qty}
                      disabled={locked}
                      onChange={(e) => patchSlot(kitIndex, slotIndex, { qty: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    disabled={locked || kit.slots.length === 1}
                    aria-label={`Xóa món ${slotIndex + 1}`}
                    onClick={() => patchKit(kitIndex, (k) => ({ ...k, slots: k.slots.filter((_, i) => i !== slotIndex) }))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div>
                  <p className="mb-1.5 text-sm text-muted-foreground">Phương án (chọn một hoặc nhiều)</p>
                  <div className="flex flex-wrap gap-2">
                    {itemOptions.map((id) => {
                      const on = slot.product_ids.includes(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          disabled={locked}
                          onClick={() =>
                            patchSlot(kitIndex, slotIndex, {
                              product_ids: on ? slot.product_ids.filter((p) => p !== id) : [...slot.product_ids, id],
                            })
                          }
                          className={cn(
                            'min-h-11 max-w-full break-words rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:min-h-10',
                            on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent',
                          )}
                        >
                          {names[id] ?? 'Sản phẩm'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </fieldset>
            ))}
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={locked || kit.slots.length >= 10}
                onClick={() => patchKit(kitIndex, (k) => ({ ...k, slots: [...k.slots, { label: '', qty: 1, product_ids: [] }] }))}
              >
                <Plus /> Thêm món
              </Button>
            </div>
            <KitPreview kit={kit} prices={prices} genders={genders} names={names} gender={gender} />
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {invalid ? <span className="text-sm text-muted-foreground">Mỗi món cần có tên và ít nhất một phương án.</span> : null}
        <Button disabled={locked || !dirty || invalid || save.isPending} onClick={submit}>
          Lưu bộ
        </Button>
      </div>
    </div>
  )
}
