import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Product } from '@/features/catalog/api'
import { useColourLookup, useProducts } from '@/features/catalog/hooks'
import { formatNumber } from '@/lib/format'
import type { Campaign } from '../api'
import { campaignErrorMessage } from '../errors'
import { useReplaceItems } from '../hooks'
import { PRICE_PENDING, parsePrice } from '../logic'
import { LockedNotice } from './LockedNotice'

interface Row {
  product_id: string
  colour: string
  price: string
}

const toRows = (campaign: Campaign): Row[] =>
  campaign.items.map((i) => ({
    product_id: i.product_id,
    colour: i.colour,
    price: i.unit_price == null ? '' : formatNumber(i.unit_price),
  }))

export function ItemsTab({ campaign }: { campaign: Campaign }) {
  const products = useProducts()
  const colours = useColourLookup()
  const save = useReplaceItems(campaign.id)
  const [rows, setRows] = useState(() => toRows(campaign))
  const locked = campaign.status === 'LOCKED'
  const productById = new Map<string, Product>((products.data ?? []).map((p) => [p.id, p]))
  const addable = (products.data ?? []).filter((p) => !rows.some((r) => r.product_id === p.id))
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(campaign))

  const patch = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))

  const submit = () =>
    save.mutate(
      rows.map((r, sort) => ({
        product_id: r.product_id,
        colour: r.colour,
        unit_price: parsePrice(r.price),
        sort,
      })),
      {
        onSuccess: () => toast.success('Đã lưu sản phẩm và giá'),
        onError: (error) => toast.error(campaignErrorMessage(error)),
      },
    )

  return (
    <div className="flex flex-col gap-4">
      <LockedNotice status={campaign.status} />
      {rows.length === 0 ? (
        <EmptyState
          title="Chưa có sản phẩm nào"
          description="Chọn sản phẩm từ danh mục bên dưới. Sản phẩm chưa có giá vẫn đặt được và hiện “Giá đang cập nhật”."
          className="rounded-md border border-dashed border-hairline"
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-md border border-hairline bg-card">
          {rows.map((row, index) => {
            const product = productById.get(row.product_id)
            const name = product?.name ?? 'Sản phẩm đã ẩn'
            return (
              <li
                key={row.product_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
              >
                <p className="col-span-2 min-w-0 break-words font-medium md:col-span-1 md:self-center">{name}</p>
                <label className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
                  Màu
                  <NativeSelect
                    value={row.colour}
                    disabled={locked}
                    onChange={(e) => patch(index, { colour: e.target.value })}
                    aria-label={`Màu của ${name}`}
                  >
                    {(product?.colours ?? [row.colour]).map((c) => (
                      <option key={c} value={c}>
                        {colours.label(c)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="col-start-1 flex min-w-0 flex-col gap-1 text-sm text-muted-foreground md:col-start-auto">
                  Đơn giá (đ)
                  <Input
                    inputMode="numeric"
                    value={row.price}
                    disabled={locked}
                    placeholder={PRICE_PENDING}
                    aria-label={`Đơn giá của ${name}`}
                    onChange={(e) => {
                      const value = parsePrice(e.target.value)
                      patch(index, { price: value == null ? '' : formatNumber(value) })
                    }}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={locked}
                  aria-label={`Bỏ ${name}`}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex w-full max-w-sm flex-col gap-1 text-sm text-muted-foreground">
          Thêm sản phẩm từ danh mục
          <NativeSelect
            value=""
            disabled={locked || addable.length === 0}
            onChange={(e) => {
              const product = productById.get(e.target.value)
              if (product) setRows((current) => [...current, { product_id: product.id, colour: product.colours[0] ?? 'ghi', price: '' }])
            }}
          >
            <option value="">{addable.length === 0 ? 'Đã thêm hết sản phẩm' : 'Chọn sản phẩm…'}</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{rows.length} sản phẩm</span>
          <Button disabled={locked || !dirty || save.isPending} onClick={submit}>
            Lưu sản phẩm và giá
          </Button>
        </div>
      </div>
    </div>
  )
}
