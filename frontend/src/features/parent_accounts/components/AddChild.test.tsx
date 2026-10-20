import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddChild } from './AddChild'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const MATCH = { found: true, ambiguous: false, full_name: 'Nguyễn Văn An', school_name: 'Trường A', class_name: '2A1' }

let claimResponse: () => Response

beforeEach(() => {
  claimResponse = () => json({ error: { code: 'http_error', message: 'x' } }, 500)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'http://x').pathname
      if (path === '/api/parent/schools') return json([{ id: 's1', name: 'Trường A', code: 'A' }])
      if (path === '/api/parent/children/lookup') return json(MATCH)
      if (path === '/api/parent/children/claim') return claimResponse()
      return json({ error: { code: 'not_found', message: 'x' } }, 404)
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

async function searchUntilConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText('Trường'), 's1')
  await user.type(screen.getByLabelText('Họ và tên học sinh'), 'Nguyễn Văn An')
  await user.selectOptions(screen.getByLabelText('Ngày'), '14')
  await user.selectOptions(screen.getByLabelText('Tháng'), '3')
  await user.selectOptions(screen.getByLabelText('Năm'), '2018')
  await user.click(screen.getByRole('button', { name: 'Tìm hồ sơ' }))
  await screen.findByRole('heading', { name: 'Xác nhận học sinh' })
}

function renderAddChild() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddChild />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

describe('AddChild', () => {
  it('does not carry a failed claim error into the next confirm step', async () => {
    const user = renderAddChild()
    await searchUntilConfirm(user)

    await user.click(screen.getByRole('button', { name: 'Đúng, nhận hồ sơ này' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa nhận được hồ sơ')

    await user.click(screen.getByRole('button', { name: 'Không đúng' }))
    await user.click(await screen.findByRole('button', { name: 'Tìm hồ sơ' }))
    await screen.findByRole('heading', { name: 'Xác nhận học sinh' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('returns to search with a notice and no stale error when the match disappeared', async () => {
    claimResponse = () => json({ error: { code: 'no_match', message: 'x' } }, 404)
    const user = renderAddChild()
    await searchUntilConfirm(user)

    await user.click(screen.getByRole('button', { name: 'Đúng, nhận hồ sơ này' }))

    expect(await screen.findByRole('status')).toHaveTextContent('không còn khớp')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
