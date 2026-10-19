import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Product } from '@/features/catalog/api'
import { FitChoice } from '@/components/FitChoice'
import { SizeLabel } from '@/components/SizeLabel'
import type { Fit } from '@/lib/fit'
import { NOTE_MAX, derivedSize, trialErrorKey, type TrialRow } from './formLogic'
import { NativeSelect } from '@/components/NativeSelect'

interface ProductTrialCardProps {
  product: Product
  rows: TrialRow[]
  suggestion: { ready: boolean; size: string | null }
  errors: Record<string, string>
  onAdd: () => void
  onRemove: (key: string) => void
  onChange: (key: string, patch: Partial<TrialRow>) => void
}

export function ProductTrialCard({ product, rows, suggestion, errors, onAdd, onRemove, onChange }: ProductTrialCardProps) {
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({})
  const derived = derivedSize(rows, product)
  return (
    <Card className="gap-3 p-4" role="group" aria-label={product.name}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">{product.name}</h3>
        {suggestion.ready && product.has_size_guide ? (
          suggestion.size ? (
            <p className="flex items-center gap-2 text-sm">
              Gợi ý: <SizeLabel label={suggestion.size} /> <span className="text-muted-foreground">(bảng tạm)</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có gợi ý cho số đo này</p>
          )
        ) : product.has_size_guide ? (
          <p className="text-sm text-muted-foreground">Nhập chiều cao và cân nặng để xem gợi ý cỡ</p>
        ) : null}
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const err = errors[trialErrorKey(row.key)]
          const open = noteOpen[row.key] || row.note !== ''
          const label = `${product.name} ${i + 1}`
          return (
            <li key={row.key} className="flex flex-col gap-2 rounded-md border border-hairline p-3">
              <div className="flex items-center gap-2">
                <NativeSelect
                  aria-label={`Cỡ thử ${label}`}
                  aria-invalid={Boolean(err) && !row.size}
                  value={row.size}
                  onChange={(e) => onChange(row.key, { size: e.target.value, manual: true })}
                >
                  <option value="">Chọn cỡ</option>
                  {product.sizes.map((s) => (
                    <option key={s} value={s} disabled={rows.some((o) => o.key !== row.key && o.size === s)}>
                      Cỡ {s}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0 md:size-10"
                  aria-label={`Xoá cỡ thử ${label}`}
                  onClick={() => onRemove(row.key)}
                >
                  <Trash2 />
                </Button>
              </div>
              <FitChoice
                aria-label={`Độ vừa cỡ thử ${label}`}
                invalid={Boolean(err) && !row.fit}
                value={row.fit}
                onChange={(fit: Fit) => onChange(row.key, { fit })}
              />
              {open ? (
                <textarea
                  aria-label={`Ghi chú ${label}`}
                  maxLength={NOTE_MAX}
                  rows={2}
                  value={row.note}
                  onChange={(e) => onChange(row.key, { note: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 justify-start px-2 text-muted-foreground md:h-9"
                  onClick={() => setNoteOpen((s) => ({ ...s, [row.key]: true }))}
                >
                  Ghi chú
                </Button>
              )}
              {err ? (
                <p role="alert" className="text-sm text-destructive">
                  {err}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onAdd}>
          <Plus /> Thêm cỡ đã thử
        </Button>
        {derived ? (
          <p className="flex items-center gap-2 text-sm">
            Cỡ vừa (suy ra): <SizeLabel label={derived} scale="md" />
          </p>
        ) : null}
      </div>
    </Card>
  )
}
