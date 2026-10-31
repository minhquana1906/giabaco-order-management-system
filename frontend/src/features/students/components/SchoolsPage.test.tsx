import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { SchoolsPage } from './SchoolsPage'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

it('loads classes for the selected school', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/schools') return json([{ id: 's1', name: 'Trường A', code: 'A' }, { id: 's2', name: 'Trường B', code: 'B' }])
    if (path === '/api/schools/s1/classes') return json([{ id: 'c1', grade: 1, name: '1A' }])
    if (path === '/api/schools/s2/classes') return json([{ id: 'c2', grade: 2, name: '2B' }])
    return json({}, 404)
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SchoolsPage /></QueryClientProvider>)
  expect(await screen.findByText('1A')).toBeInTheDocument()
  await userEvent.setup().selectOptions(screen.getByLabelText('Trường'), 's2')
  expect(await screen.findByText('2B')).toBeInTheDocument()
  expect(screen.queryByText('1A')).not.toBeInTheDocument()
})

it('shows one grade at a time and switches by tab', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/schools') return json([{ id: 's1', name: 'Trường A', code: 'A' }])
    if (path === '/api/schools/s1/classes') {
      return json([{ id: 'c1', grade: 1, name: '1A1' }, { id: 'c2', grade: 1, name: '1A2' }, { id: 'c3', grade: 2, name: '2A1' }])
    }
    return json({}, 404)
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SchoolsPage /></QueryClientProvider>)
  expect(await screen.findByText('1A2')).toBeInTheDocument()
  expect(screen.queryByText('2A1')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('tab', { name: /Khối 2/ }))
  expect(await screen.findByText('2A1')).toBeInTheDocument()
  expect(screen.queryByText('1A1')).not.toBeInTheDocument()
})

it('names each edit button after its class and pre-selects the active grade when adding', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/schools') return json([{ id: 's1', name: 'Trường A', code: 'A' }])
    if (path === '/api/schools/s1/classes') return json([{ id: 'c1', grade: 1, name: '1A1' }, { id: 'c3', grade: 2, name: '2A1' }])
    return json({}, 404)
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SchoolsPage /></QueryClientProvider>)
  const user = userEvent.setup()
  expect(await screen.findByRole('button', { name: 'Sửa lớp 1A1' })).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Khối 2/ }))
  expect(await screen.findByRole('button', { name: 'Sửa lớp 2A1' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Thêm lớp mới/ }))
  expect(await screen.findByRole('combobox', { name: 'Khối' })).toHaveValue('2')
  expect(screen.getByLabelText('Tên lớp')).toHaveValue('2')
})
