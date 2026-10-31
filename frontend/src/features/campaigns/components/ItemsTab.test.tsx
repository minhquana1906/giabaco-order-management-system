import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Campaign } from '../api'
import { ItemsTab } from './ItemsTab'

const mutate = vi.fn()

vi.mock('@/features/catalog/hooks', () => ({
  useProducts: () => ({ data: [{ id: 'p1', name: 'Áo', colours: ['white'], tailor_measurements: [] }] }),
  useColourLookup: () => ({ label: (value: string) => value }),
}))
vi.mock('../hooks', () => ({ useReplaceItems: () => ({ mutate, isPending: false }) }))

const campaign: Campaign = {
  id: 'c1', school_id: 's1', name: 'Đợt 1', school_year: '2026', opens_at: '2026-01-01', closes_at: null,
  status: 'DRAFT', updated_at: '2026-01-01', kits: [],
  items: [{ product_id: 'p1', colour: 'white', unit_price: 1000, sort: 0, ...{ tailor_enabled: true } }],
}

describe('ItemsTab', () => {
  it('does not show a tailoring checkbox or submit the legacy flag when saving', async () => {
    const user = userEvent.setup()
    render(<ItemsTab campaign={campaign} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Đơn giá của Áo'))
    await user.type(screen.getByLabelText('Đơn giá của Áo'), '2000')
    await user.click(screen.getByRole('button', { name: 'Lưu sản phẩm và giá' }))

    expect(mutate).toHaveBeenCalledWith(
      [{ product_id: 'p1', colour: 'white', unit_price: 2000, sort: 0 }],
      expect.any(Object),
    )
  })
})
