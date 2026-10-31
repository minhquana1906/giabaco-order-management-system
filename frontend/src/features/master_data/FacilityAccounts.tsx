import { useState, type FormEvent } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { Field } from '@/components/Field'
import { LoadingRows } from '@/components/LoadingRows'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { staffApi, useStaff, useStaffWrite, type Staff, type StaffChange } from './api'

const touch = 'h-11 md:h-10'
const USERNAME = '[a-z0-9._\\-]{3,32}'

function StaffRow({ facilityId, staff }: { facilityId: string; staff: Staff }) {
  const [username, setUsername] = useState(staff.username)
  const [password, setPassword] = useState('')
  const update = useStaffWrite(facilityId, (body: StaffChange) => staffApi.update(facilityId, staff.id, body))
  return (
    <li className="flex flex-col gap-3 border-t border-hairline py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium break-all">{staff.username}</p>
          {staff.disabled_at ? <Badge variant="secondary">Đã khóa</Badge> : <Badge variant="info">Đang hoạt động</Badge>}
        </div>
        <Button
          variant="outline"
          className="min-h-11 md:min-h-9"
          disabled={update.isPending}
          onClick={() => update.mutate({ disabled: !staff.disabled_at })}
        >
          {staff.disabled_at ? 'Mở khóa' : 'Khóa tài khoản'}
        </Button>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <form
          className="flex min-w-0 flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate({ username: username.trim() })
          }}
        >
          <Field className="min-w-0 flex-[1_1_10rem]" id={`edit-username-${staff.id}`} label="Tên đăng nhập mới">
            {(control) => (
              <Input {...control} className={touch} required minLength={3} maxLength={32} pattern={USERNAME} value={username} onChange={(e) => setUsername(e.target.value)} />
            )}
          </Field>
          <Button variant="outline" className={touch} disabled={update.isPending || username.trim() === staff.username}>
            Đổi tên
          </Button>
        </form>
        <form
          className="flex min-w-0 flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate({ password }, { onSuccess: () => setPassword('') })
          }}
        >
          <Field className="min-w-0 flex-[1_1_10rem]" id={`password-${staff.id}`} label="Mật khẩu mới (ít nhất 8 ký tự)">
            {(control) => (
              <Input {...control} className={touch} type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          <Button variant="outline" className={touch} disabled={update.isPending}>
            Đổi mật khẩu
          </Button>
        </form>
      </div>
    </li>
  )
}

/** Accounts the partner uses to sign in and report production progress. */
export function FacilityAccounts({ facilityId }: { facilityId: string }) {
  const staff = useStaff(facilityId)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const create = useStaffWrite(facilityId, (body: { username: string; password: string }) => staffApi.create(facilityId, body))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({ username: username.trim(), password }, { onSuccess: () => { setUsername(''); setPassword('') } })
  }
  return (
    <section aria-labelledby={`accounts-${facilityId}`} className="flex flex-col gap-4 border-t border-hairline pt-5">
      <h3 id={`accounts-${facilityId}`} className="text-[15px] font-semibold">
        Tài khoản đối tác
      </h3>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field id={`username-${facilityId}`} label="Tên đăng nhập (chữ thường, số, . _ -)">
          {(control) => (
            <Input {...control} className={touch} required minLength={3} maxLength={32} pattern={USERNAME} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
        </Field>
        <Field id={`new-password-${facilityId}`} label="Mật khẩu (ít nhất 8 ký tự)">
          {(control) => (
            <Input {...control} className={touch} required minLength={8} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Button className={touch} disabled={create.isPending}>
          Thêm tài khoản
        </Button>
      </form>
      {staff.isPending ? (
        <LoadingRows rows={2} />
      ) : staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      ) : staff.data.length ? (
        <ul>
          {staff.data.map((s) => (
            <StaffRow key={s.id} facilityId={facilityId} staff={s} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Đối tác này chưa có tài khoản. Tạo tài khoản bên dưới.</p>
      )}
    </section>
  )
}
