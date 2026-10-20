import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hotline } from './ParentShell'

describe('Hotline', () => {
  it('puts the lead and the contact line on separate lines with a tel link', () => {
    render(<Hotline lead="Bạn không tìm thấy trường?" />)
    const lead = screen.getByText('Bạn không tìm thấy trường?')
    expect(lead).toHaveClass('block')
    expect(lead.nextElementSibling).toHaveTextContent('Vui lòng liên hệ Giabaco (0835352004).')
    expect(screen.getByRole('link', { name: '0835352004' })).toHaveAttribute('href', 'tel:0835352004')
  })
})
