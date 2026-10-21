import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChildSummary } from '../api'
import { ChildrenList } from './ChildrenList'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}))

const child = (patch: Partial<ChildSummary> = {}): ChildSummary => ({
  student_id: 's1',
  full_name: 'Nguyễn Văn An',
  school_id: 'sc',
  school_name: 'Trường A',
  class_id: 'c',
  class_name: '2A1',
  gender: 'MALE',
  data_source: 'ADMIN_MEASURED',
  parent_name: null,
  parent_phone: null,
  parent_email: null,
  order_summary: null,
  campaign_open: true,
  ...patch,
})

function renderList(data: ChildSummary[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChildrenList />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('ChildrenList', () => {
  it('says the school has not opened registration when there is no open campaign', async () => {
    renderList([child({ campaign_open: false })])
    expect(await screen.findByText('Trường chưa mở đăng ký đồng phục')).toBeInTheDocument()
  })

  it('says the child is not registered when the campaign is open', async () => {
    renderList([child()])
    expect(await screen.findByText('Chưa đăng ký đồng phục')).toBeInTheDocument()
  })
})
