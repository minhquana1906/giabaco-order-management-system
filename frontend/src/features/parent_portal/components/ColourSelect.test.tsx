import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Colour } from '../api'
import { ColourSelect } from './ColourSelect'

const GHI = { code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }
const NAVY = { code: 'navy', label: 'Navy', hex: '#1b2b4b' }

function renderSelect(colours: Colour[], value: string | null, extra: { invalid?: boolean } = {}, onChange = vi.fn()) {
  render(
    <>
      <span id="lbl">Màu sắc</span>
      <ColourSelect name="c" colours={colours} labelledBy="lbl" value={value} onChange={onChange} {...extra} />
    </>,
  )
  return onChange
}

describe('ColourSelect', () => {
  it('renders the colours it is given as a radiogroup and reports the picked one', async () => {
    const onChange = renderSelect([NAVY, GHI], 'navy')
    expect(screen.getByRole('radiogroup', { name: 'Màu sắc' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Navy' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Ghi' })).not.toBeChecked()
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Ghi' }))
    expect(onChange).toHaveBeenCalledWith('ghi')
  })

  it('renders nothing for a single colour', () => {
    renderSelect([GHI], 'ghi')
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('flags the group when invalid and nothing is chosen', () => {
    renderSelect([NAVY, GHI], null, { invalid: true })
    expect(screen.getByRole('radio', { name: 'Navy' })).not.toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Màu sắc' })).toHaveAttribute('aria-invalid', 'true')
  })
})
