import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ColourSelect } from './ColourSelect'

describe('ColourSelect', () => {
  it('exposes both colours as a radiogroup and reports the picked one', async () => {
    const onChange = vi.fn()
    render(
      <>
        <span id="lbl">Màu sắc</span>
        <ColourSelect productCode="blazer" labelledBy="lbl" value="navy" onChange={onChange} />
      </>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Màu sắc' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Navy' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Ghi' })).not.toBeChecked()

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Ghi' }))
    expect(onChange).toHaveBeenCalledWith('ghi')
  })
})
