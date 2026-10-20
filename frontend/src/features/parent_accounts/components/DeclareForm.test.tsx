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

describe('DeclareForm', () => {
  it('does not ask for parent contact details', async () => {
    setup()
    await screen.findByLabelText('Lớp')
    expect(screen.queryByText('Người liên hệ')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Số điện thoại')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
  })

  it('focuses the first invalid field on submit', async () => {
    const { user, onSubmit } = setup()
    await screen.findByLabelText('Lớp')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Vui lòng chọn lớp.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Lớp')).toHaveFocus())
  })

  it('submits only the student fields', async () => {
    const { user, onSubmit } = setup()
    await fillChild(user)
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(onSubmit).toHaveBeenCalledWith({ class_id: 'c1', gender: 'FEMALE', height_cm: 126.5, weight_kg: 24 })
  })

  it('maps server 422 errors onto the student fields', async () => {
    setup(new ApiError(422, 'validation_error', 'x', { height_cm: 'Chiều cao không hợp lệ' }))
    expect(await screen.findByText('Chiều cao không hợp lệ')).toBeInTheDocument()
    expect(screen.queryByText(/Chưa lưu được/)).not.toBeInTheDocument()
  })
})
