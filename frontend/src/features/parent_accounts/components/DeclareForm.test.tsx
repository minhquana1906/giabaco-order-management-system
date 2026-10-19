import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http'
import { DeclareForm } from './DeclareForm'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => json([{ id: 'c1', school_id: 's1', grade: 2, name: '2A1' }])))
})
afterEach(() => vi.unstubAllGlobals())

function setup(error: unknown = null) {
  const onSubmit = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DeclareForm schoolId="s1" submitLabel="Lưu" pendingLabel="…" pending={false} error={error} onSubmit={onSubmit} />
    </QueryClientProvider>,
  )
  return { onSubmit, user: userEvent.setup() }
}

async function fillChild(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText('Lớp'), 'c1')
  await user.click(screen.getByLabelText('Nữ'))
  await user.type(screen.getByLabelText('Chiều cao (cm)'), '126,5')
  await user.type(screen.getByLabelText('Cân nặng (kg)'), '24')
}

describe('DeclareForm parent section', () => {
  it('requires the parent phone and focuses the first invalid field', async () => {
    const { user, onSubmit } = setup()
    await fillChild(user)
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Nhập số điện thoại phụ huynh.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Số điện thoại phụ huynh')).toHaveFocus())
  })

  it('submits optional parent fields as null when left empty', async () => {
    const { user, onSubmit } = setup()
    await fillChild(user)
    await user.type(screen.getByLabelText('Số điện thoại phụ huynh'), '0912345678')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(onSubmit).toHaveBeenCalledWith({
      class_id: 'c1',
      gender: 'FEMALE',
      height_cm: 126.5,
      weight_kg: 24,
      parent_phone: '0912345678',
      parent_name: null,
      parent_email: null,
    })
  })

  it('maps server 422 errors onto the parent fields', async () => {
    setup(new ApiError(422, 'validation_error', 'x', { parent_phone: 'Số điện thoại không hợp lệ' }))
    expect(await screen.findByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
    expect(screen.queryByText(/Chưa lưu được/)).not.toBeInTheDocument()
  })
})
