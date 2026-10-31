import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useSaveRecord, type RecordItem } from './api'
import { FacilityAccounts } from './FacilityAccounts'
import {
  CHOICES,
  isBlank,
  KEY_FIELDS,
  KIND_LABEL,
  labelOf,
  requiredFor,
  SECTIONS,
  WIDE_FIELDS,
  type Data,
  type Definition,
  type Kind,
} from './fields'

const CONTROL = 'border border-input bg-transparent text-base md:text-sm'

interface RecordSheetProps {
  kind: Kind
  definition: Definition
  record: RecordItem | null
  onClose: () => void
  onDelete: (record: RecordItem) => void
}

export function RecordSheet({ kind, definition, record, onClose, onDelete }: RecordSheetProps) {
  const [draft, setDraft] = useState<Data>(record?.data ?? {})
  const save = useSaveRecord(kind)
  const required = requiredFor(definition, draft)
  const missing = [...required].filter((field) => isBlank(draft[field])).length
  const codeField = KEY_FIELDS[kind].code
  const placed = new Set(SECTIONS[kind].flatMap((section) => section.fields))
  const leftover = definition.fields.filter((field) => !placed.has(field))
  const sections = leftover.length ? [...SECTIONS[kind], { title: 'Khác', fields: leftover }] : SECTIONS[kind]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate({ id: record?.id, data: draft }, { onSuccess: onClose })
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-hairline pr-14">
          <SheetTitle className="text-lg">{record ? 'Chi tiết hồ sơ' : 'Thêm hồ sơ'}</SheetTitle>
          <SheetDescription>
            {KIND_LABEL[kind]}
            {record ? ` · ${record.data[codeField]}` : ''}
          </SheetDescription>
          {missing > 0 ? (
            <Badge variant="warning" className="mt-1">
              <TriangleAlert aria-hidden /> Còn {missing} mục cần bổ sung
            </Badge>
          ) : null}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
            <form id={`record-${kind}`} onSubmit={submit} className="flex flex-col gap-6">
            {sections.map((section, index) => (
              <section
                key={section.title}
                aria-labelledby={`section-${index}`}
                className={cn('flex flex-col gap-4', index > 0 && 'border-t border-hairline pt-5')}
              >
                <h3 id={`section-${index}`} className="text-[15px] font-semibold">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {section.fields
                    .filter((field) => definition.fields.includes(field))
                    .map((field) => {
                      const id = `${kind}-${definition.fields.indexOf(field)}`
                      const gap = required.has(field) && isBlank(draft[field])
                      const props = {
                        id,
                        value: draft[field] ?? '',
                        'aria-describedby': gap ? `${id}-hint` : undefined,
                        className: cn(CONTROL, gap && 'border-warning'),
                        onChange: (event: { target: { value: string } }) =>
                          setDraft({ ...draft, [field]: event.target.value }),
                      }
                      return (
                        <div
                          key={field}
                          className={cn('flex min-w-0 flex-col gap-1.5', WIDE_FIELDS[field] && 'sm:col-span-2')}
                        >
                          <Label htmlFor={id} className="leading-snug">
                            {labelOf(field)}
                          </Label>
                          {gap ? (
                            <p id={`${id}-hint`} className="flex items-center gap-1 text-xs font-medium text-warning-ink">
                              <TriangleAlert aria-hidden className="size-3.5" /> Cần bổ sung
                            </p>
                          ) : null}
                          {CHOICES[field] ? (
                            <NativeSelect {...props} className={cn(props.className, 'bg-background')}>
                              <option value="">Chưa chọn</option>
                              {/* Imported values outside the list stay selectable until changed. */}
                              {[...new Set([...CHOICES[field], ...(props.value ? [props.value] : [])])].map((choice) => (
                                <option key={choice} value={choice}>
                                  {choice}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : WIDE_FIELDS[field] ? (
                            <textarea
                              {...props}
                              rows={3}
                              maxLength={10000}
                              className={cn(
                                props.className,
                                'min-h-20 w-full rounded-md px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              )}
                            />
                          ) : (
                            <Input
                              {...props}
                              className={cn(props.className, 'h-11 md:h-10')}
                              required={field === codeField}
                              disabled={!!record && field === codeField}
                              maxLength={field === codeField ? 255 : 10000}
                            />
                          )}
                          {record && field === codeField ? (
                            <p className="text-xs text-muted-foreground">Mã không đổi được sau khi tạo.</p>
                          ) : null}
                        </div>
                      )
                    })}
                </div>
              </section>
            ))}
            </form>
            {record && kind === 'products' ? (
              <section aria-labelledby="linked-products" className="flex flex-col gap-2 border-t border-hairline pt-5">
                <h3 id="linked-products" className="text-[15px] font-semibold">
                  Sản phẩm bán hàng dùng mã này
                </h3>
                {record.linked_products?.length ? (
                  <ul className="list-disc pl-5 text-sm">
                    {record.linked_products.map((product) => (
                      <li key={product.id}>{product.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có. Chọn mã này ở ô "Mã sản phẩm gốc" trong biểu mẫu sản phẩm (trang Sản phẩm).
                  </p>
                )}
              </section>
            ) : null}
            {record && kind === 'facilities' ? <FacilityAccounts facilityId={record.id} /> : null}
          </div>
          <div className="flex flex-col gap-2 border-t border-hairline bg-background p-4">
            {save.error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {save.error.message}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {record ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 text-danger-ink hover:bg-danger-soft hover:text-danger-ink sm:mr-auto"
                  onClick={() => onDelete(record)}
                >
                  Xóa hồ sơ
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" form={`record-${kind}`} className="min-h-11" disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
