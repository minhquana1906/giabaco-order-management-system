import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentForm } from './StudentForm'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const SIZES = ['1', '2', '3', '4', '5', '6', '7']
const PRODUCTS = [
  { id: 'p1', code: 'blazer', name: 'Áo Blazer', sizes: SIZES, has_size_guide: true },
  { id: 'p2', code: 'gile', name: 'Áo Gile', sizes: SIZES, has_size_guide: true },
]

let posted: unknown[]

function handle(url: URL, init?: RequestInit) {
  if (url.pathname === '/api/products') return json(PRODUCTS)
  if (url.pathname === '/api/schools') return json([{ id: 's1', name: 'Trường A', code: 'A' }])
  if (url.pathname === '/api/schools/s1/classes') return json([{ id: 'c1', school_id: 's1', grade: 2, name: '2A1' }])
  if (url.pathname === '/api/size-suggestions') {
    return Number(url.searchParams.get('height_cm')) < 130
      ? json({ blazer: '2', gile: null })
      : json({ blazer: '4', gile: '4' })
  }
  if (url.pathname === '/api/students' && init?.method === 'POST') {
    posted.push(JSON.parse(String(init.body)))
    return json({ id: 'st1' }, 201)
  }
  return json({ error: { code: 'not_found', message: 'x' } }, 404)
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSaved = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <StudentForm initialContext={{ schoolId: 's1', classId: 'c1' }} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), onSaved }
}

const card = (name: string) => screen.findByRole('group', { name })
const sizeSelect = (c: HTMLElement, i = 1) => within(c).getByRole('combobox', { name: new RegExp(`^Cỡ thử .* ${i}$`) })

async function enterMeasures(user: ReturnType<typeof userEvent.setup>, h: string, w: string) {
  const height = screen.getByLabelText('Chiều cao (cm)')
  const weight = screen.getByLabelText('Cân nặng (kg)')
  await user.clear(height)
  await user.type(height, h)
  await user.clear(weight)
  await user.type(weight, w)
}

beforeEach(() => {
  posted = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handle(new URL(String(input), 'http://x'), init)),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('StudentForm trials', () => {
  it('adds and removes trial rows', async () => {
    const { user } = setup()
    const blazer = await card('Áo Blazer')
    expect(within(blazer).queryAllByRole('combobox')).toHaveLength(0)
    await user.click(within(blazer).getByRole('button', { name: 'Thêm cỡ đã thử' }))
    await user.click(within(blazer).getByRole('button', { name: 'Thêm cỡ đã thử' }))
    expect(within(blazer).getAllByRole('combobox')).toHaveLength(2)
    await user.click(within(blazer).getByRole('button', { name: 'Xoá cỡ thử Áo Blazer 1' }))
    expect(within(blazer).getAllByRole('combobox')).toHaveLength(1)
  })

  it('disables sizes already used in the same card only', async () => {
    const { user } = setup()
    const blazer = await card('Áo Blazer')
    const gile = await card('Áo Gile')
    await user.click(within(blazer).getByRole('button', { name: 'Thêm cỡ đã thử' }))
    await user.click(within(blazer).getByRole('button', { name: 'Thêm cỡ đã thử' }))
    await user.selectOptions(sizeSelect(blazer, 1), '3')
    expect(within(sizeSelect(blazer, 2)).getByRole('option', { name: 'Cỡ 3' })).toBeDisabled()
    expect(within(sizeSelect(blazer, 1)).getByRole('option', { name: 'Cỡ 3' })).toBeEnabled()
    await user.click(within(gile).getByRole('button', { name: 'Thêm cỡ đã thử' }))
    expect(within(sizeSelect(gile, 1)).getByRole('option', { name: 'Cỡ 3' })).toBeEnabled()
  })
})

describe('StudentForm validation', () => {
  it('shows range errors for height and weight', async () => {
    const { user } = setup()
    await card('Áo Blazer')
    await user.type(screen.getByLabelText('Chiều cao (cm)'), '80')
    await user.type(screen.getByLabelText('Cân nặng (kg)'), '95')
    await user.tab()
    expect(screen.getByText('Chiều cao từ 90 đến 190 cm')).toBeInTheDocument()
    expect(screen.getByText('Cân nặng từ 10 đến 90 kg')).toBeInTheDocument()
  })

  it('blocks saving a hand-picked size without a fit and ignores untouched suggestions', async () => {
    const { user, onSaved } = setup()
    const blazer = await card('Áo Blazer')
    await user.type(screen.getByLabelText('Họ tên'), 'Nguyễn Minh Khang')
    await user.selectOptions(screen.getByLabelText('Ngày'), '14')
    await user.selectOptions(screen.getByLabelText('Tháng'), '3')
    await user.selectOptions(screen.getByLabelText('Năm'), '2018')
    await user.click(screen.getByLabelText('Nam'))
    await enterMeasures(user, '150', '38')
    await waitFor(() => expect(within(blazer).getByText('(bảng tạm)')).toBeInTheDocument())
    expect(sizeSelect(blazer)).toHaveValue('4')
    await user.selectOptions(sizeSelect(blazer), '5')
    await user.click(screen.getByRole('button', { name: 'Lưu học sinh' }))
    expect(await screen.findAllByText('Chọn Chật / Vừa / Rộng cho cỡ 5')).toHaveLength(1)
    expect(screen.queryByText('Chọn Chật / Vừa / Rộng cho cỡ 4')).not.toBeInTheDocument()
    expect(posted).toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('saves only the rows the user completed', async () => {
    const { user, onSaved } = setup()
    const blazer = await card('Áo Blazer')
    await user.type(screen.getByLabelText('Họ tên'), 'Nguyễn Minh Khang')
    await user.selectOptions(screen.getByLabelText('Ngày'), '14')
    await user.selectOptions(screen.getByLabelText('Tháng'), '3')
    await user.selectOptions(screen.getByLabelText('Năm'), '2018')
    await user.click(screen.getByLabelText('Nam'))
    await enterMeasures(user, '150', '38')
    await waitFor(() => expect(sizeSelect(blazer)).toHaveValue('4'))
    await user.click(within(blazer).getByLabelText('Vừa'))
    const gile = await card('Áo Gile')
    await user.click(within(gile).getByRole('button', { name: 'Xoá cỡ thử Áo Gile 1' }))
    await user.click(screen.getByRole('button', { name: 'Lưu học sinh' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(posted[0]).toMatchObject({
      school_id: 's1',
      class_id: 'c1',
      dob: '2018-03-14',
      height_cm: 150,
      weight_kg: 38,
      trials: [{ product_code: 'blazer', size_label: '4', fit: 'FITS', id: null }],
    })
  })
})

describe('StudentForm size suggestions', () => {
  it('pre-fills an empty card with the suggested size and no fit selected', async () => {
    const { user } = setup()
    const blazer = await card('Áo Blazer')
    const gile = await card('Áo Gile')
    await enterMeasures(user, '126.5', '24')
    await waitFor(() => expect(sizeSelect(blazer)).toHaveValue('2'))
    expect(within(blazer).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect(within(gile).getByText('Chưa có gợi ý cho số đo này')).toBeInTheDocument()
    expect(within(gile).queryAllByRole('combobox')).toHaveLength(0)
  })

  it('follows new suggestions until the size is changed by hand, then never overwrites', async () => {
    const { user } = setup()
    const blazer = await card('Áo Blazer')
    await enterMeasures(user, '126.5', '24')
    await waitFor(() => expect(sizeSelect(blazer)).toHaveValue('2'))

    await enterMeasures(user, '150', '38')
    await waitFor(() => expect(sizeSelect(blazer)).toHaveValue('4'))
    expect(within(blazer).getAllByRole('combobox')).toHaveLength(1)

    await user.selectOptions(sizeSelect(blazer), '6')
    await enterMeasures(user, '126.5', '24')
    await waitFor(() => expect(within(blazer).getByText('Cỡ 2', { selector: 'span' })).toBeInTheDocument())
    expect(sizeSelect(blazer)).toHaveValue('6')
  })

  it('keeps the size of a suggested row once a fit is recorded, even if measurements change', async () => {
    const { user } = setup()
    const blazer = await card('Áo Blazer')
    await enterMeasures(user, '126.5', '24')
    await waitFor(() => expect(sizeSelect(blazer)).toHaveValue('2'))
    await user.click(within(blazer).getByLabelText('Vừa'))

    await enterMeasures(user, '150', '38')
    await waitFor(() => expect(within(blazer).getByText('Cỡ 4', { selector: 'span' })).toBeInTheDocument())
    expect(sizeSelect(blazer)).toHaveValue('2')
  })
})
