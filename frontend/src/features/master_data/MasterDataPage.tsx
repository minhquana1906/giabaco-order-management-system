import { Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingRows } from '@/components/LoadingRows'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDefinitions, useDeleteRecord, useRecords, useSummary, type RecordItem } from './api'
import { fold, isBlank, KEY_FIELDS, KIND_LABEL, KINDS, labelOf, type Kind } from './fields'
import { RecordSheet } from './RecordSheet'

function Missing() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-ink">
      <TriangleAlert aria-hidden className="size-3.5" /> Cần bổ sung
    </span>
  )
}

function Value({ record, field }: { record: RecordItem; field: string }) {
  const value = record.data[field]
  if (!isBlank(value)) return <>{value}</>
  if (record.missing_fields.includes(field)) return <Missing />
  return (
    <>
      <span aria-hidden className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">Chưa có</span>
    </>
  )
}

function Completeness({ record }: { record: RecordItem }) {
  const count = record.missing_fields.length
  return count > 0 ? (
    <Badge variant="warning">
      <TriangleAlert aria-hidden /> Cần bổ sung {count} mục
    </Badge>
  ) : (
    <Badge variant="success">Đầy đủ</Badge>
  )
}

function OpenButton({ code, onOpen }: { code: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="rounded-sm text-left font-medium tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      {code}
    </button>
  )
}

export function MasterDataPage() {
  const [kind, setKind] = useState<Kind>('facilities')
  const [query, setQuery] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [editor, setEditor] = useState<{ record: RecordItem | null } | null>(null)
  const [removing, setRemoving] = useState<RecordItem | null>(null)
  const definitions = useDefinitions()
  const summary = useSummary()
  const records = useRecords(kind)
  const remove = useDeleteRecord(kind)
  const keys = KEY_FIELDS[kind]

  const needle = fold(query.trim())
  const visible = (records.data ?? []).filter(
    (record) =>
      (!onlyMissing || record.missing_fields.length > 0) &&
      (!needle || fold([keys.code, keys.name, keys.group].map((field) => record.data[field] ?? '').join(' ')).includes(needle)),
  )
  const edit = (record: RecordItem | null) => setEditor({ record })
  const confirmRemove = () => {
    if (!removing) return
    remove.mutate(removing.id, {
      onSuccess: () => {
        setRemoving(null)
        setEditor(null)
      },
    })
  }
  const closeRemove = () => {
    setRemoving(null)
    remove.reset()
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Danh mục gốc"
        actions={
          <Button disabled={!definitions.data} onClick={() => edit(null)}>
            <Plus /> Thêm hồ sơ
          </Button>
        }
      />
      <Tabs value={kind} onValueChange={(next) => setKind(next as Kind)}>
        <TabsList aria-label="Loại hồ sơ">
          {KINDS.map((key) => {
            const stat = summary.data?.[key]
            return (
              <TabsTrigger key={key} value={key} {...(key === kind ? {} : { 'aria-controls': undefined })}>
                {KIND_LABEL[key]}{' '}
                {stat ? <TabsCount>{stat.total}</TabsCount> : null}{' '}
                {stat && stat.needs_attention > 0 ? (
                  <Badge variant="warning" className="relative ml-2 tabular-nums">
                    <TriangleAlert aria-hidden /> {stat.needs_attention}
                    <span className="sr-only"> hồ sơ cần bổ sung</span>
                  </Badge>
                ) : null}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <TabsContent value={kind} className="flex flex-col gap-4">
          <div className="grid items-center gap-1 sm:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] sm:gap-4">
            <Input
              type="search"
              aria-label="Tìm hồ sơ"
              placeholder="Tìm theo mã, tên hoặc nhóm"
              className="h-11 md:h-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={onlyMissing}
                onChange={(event) => setOnlyMissing(event.target.checked)}
              />
              Chỉ hồ sơ cần bổ sung
            </label>
          </div>
          {records.isPending || definitions.isPending ? (
            <LoadingRows rows={6} />
          ) : records.isError ? (
            <ErrorState error={records.error} onRetry={() => void records.refetch()} />
          ) : definitions.isError ? (
            <ErrorState error={definitions.error} onRetry={() => void definitions.refetch()} />
          ) : records.data.length === 0 ? (
            <EmptyState title="Chưa có hồ sơ" description="Chọn Thêm hồ sơ để tạo hồ sơ đầu tiên." />
          ) : visible.length === 0 ? (
            <EmptyState title="Không có hồ sơ phù hợp" description="Đổi từ khóa hoặc bỏ bộ lọc để xem thêm." />
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {visible.length} trên {records.data.length} hồ sơ
              </p>
              <div className="hidden rounded-lg border border-hairline bg-card px-2 py-1 xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{labelOf(keys.code)}</TableHead>
                      <TableHead>{labelOf(keys.name)}</TableHead>
                      <TableHead>{labelOf(keys.group)}</TableHead>
                      {keys.stage ? <TableHead>{labelOf(keys.stage)}</TableHead> : null}
                      <TableHead>{labelOf(keys.status)}</TableHead>
                      <TableHead>Hồ sơ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((record) => (
                      <TableRow key={record.id} className="cursor-pointer" onClick={() => edit(record)}>
                        <TableCell className="whitespace-nowrap">
                          <OpenButton code={record.data[keys.code] ?? ''} onOpen={() => edit(record)} />
                        </TableCell>
                        <TableCell className="min-w-48 whitespace-normal">
                          <Value record={record} field={keys.name} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Value record={record} field={keys.group} />
                        </TableCell>
                        {keys.stage ? (
                          <TableCell className="whitespace-normal">
                            <Value record={record} field={keys.stage} />
                          </TableCell>
                        ) : null}
                        <TableCell className="whitespace-normal">
                          <Value record={record} field={keys.status} />
                        </TableCell>
                        <TableCell>
                          <Completeness record={record} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-3 xl:hidden">
                {visible.map((record) => (
                  <li
                    key={record.id}
                    className="flex cursor-pointer flex-col gap-3 rounded-md border border-hairline bg-card p-4"
                    onClick={() => edit(record)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-lining">
                        <OpenButton code={record.data[keys.code] ?? ''} onOpen={() => edit(record)} />
                      </span>
                      <Completeness record={record} />
                    </div>
                    <p className="text-[15px] font-semibold leading-snug">
                      <Value record={record} field={keys.name} />
                    </p>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">{labelOf(keys.group)}</dt>
                      <dd>
                        <Value record={record} field={keys.group} />
                      </dd>
                      {keys.stage ? (
                        <>
                          <dt className="text-muted-foreground">{labelOf(keys.stage)}</dt>
                          <dd>
                            <Value record={record} field={keys.stage} />
                          </dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground">{labelOf(keys.status)}</dt>
                      <dd>
                        <Value record={record} field={keys.status} />
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
      {editor && definitions.data ? (
        <RecordSheet
          kind={kind}
          definition={definitions.data[kind]}
          record={editor.record}
          onClose={() => setEditor(null)}
          onDelete={setRemoving}
        />
      ) : null}
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && closeRemove()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa hồ sơ?</DialogTitle>
            <DialogDescription>
              Hồ sơ {removing?.data[keys.code]}
              {removing?.data[keys.name] ? ` (${removing.data[keys.name]})` : ''} sẽ bị xóa khỏi danh mục gốc và không
              khôi phục được.
            </DialogDescription>
          </DialogHeader>
          {remove.error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {remove.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeRemove}>
              Hủy
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={confirmRemove}>
              Xóa hồ sơ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
