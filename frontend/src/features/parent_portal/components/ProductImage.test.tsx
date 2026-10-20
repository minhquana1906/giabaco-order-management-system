import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProductImage } from './ProductImage'

const blazer = { code: 'blazer', name: 'Áo Blazer', sizes: ['1', '2'] }

describe('ProductImage', () => {
  it('renders nothing for a product without a sheet', () => {
    const { container } = render(<ProductImage product={{ ...blazer, code: 'cravat' }} gender="MALE" colour="navy" sizes="96px" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the 900px sheet as a thumbnail and has no separate open-large button', () => {
    render(<ProductImage product={blazer} gender="FEMALE" colour="ghi" sizes="96px" />)
    const trigger = screen.getByRole('button', { name: 'Phóng to ảnh Áo Blazer nữ, màu Ghi' })
    expect(trigger.querySelector('img')).toHaveAttribute('src', '/products/blazer_nu_ghi_900.webp')
    expect(screen.queryByText(/Mở ảnh lớn/)).not.toBeInTheDocument()
  })

  it('opens the full-size sheet in a dialog and closes it with Escape', async () => {
    const user = userEvent.setup()
    render(<ProductImage product={blazer} gender="FEMALE" colour="navy" sizes="96px" />)

    await user.click(screen.getByRole('button', { name: /Phóng to ảnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Áo Blazer · Navy' })
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/products/blazer_nu_navy.webp')

    const zoom = screen.getByRole('button', { name: 'Phóng to' })
    expect(zoom).toHaveAttribute('aria-pressed', 'false')
    await user.click(zoom)
    expect(zoom).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
