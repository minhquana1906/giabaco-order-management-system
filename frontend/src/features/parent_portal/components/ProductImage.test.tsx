import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

  it('opens the full-size sheet in a bare dialog with only a close button, and closes it with Escape', async () => {
    const user = userEvent.setup()
    render(<ProductImage product={blazer} gender="FEMALE" colour="navy" sizes="96px" />)

    await user.click(screen.getByRole('button', { name: /Phóng to ảnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Áo Blazer · Navy' })
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/products/blazer_nu_navy.webp')
    expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Đóng'])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the dialog from the close button', async () => {
    const user = userEvent.setup()
    render(<ProductImage product={blazer} gender="FEMALE" colour="navy" sizes="96px" />)

    await user.click(screen.getByRole('button', { name: /Phóng to ảnh/ }))
    await user.click(await screen.findByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('magnifier', () => {
    const rect = { left: 0, top: 0, width: 300, height: 276, right: 300, bottom: 276, x: 0, y: 0, toJSON: () => ({}) }

    it('shows a lens and a 1600px zoom pane while the mouse is over the image, and hides them on leave', async () => {
      const user = userEvent.setup()
      const { container } = render(<ProductImage product={blazer} gender="FEMALE" colour="navy" sizes="96px" magnifier />)
      const trigger = screen.getByRole('button', { name: /Phóng to ảnh/ })
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect)

      expect(container.querySelector('[data-slot="product-lens"]')).toBeNull()
      await user.pointer({ target: trigger, coords: { clientX: 150, clientY: 138 } })
      expect(container.querySelector('[data-slot="product-lens"]')).not.toBeNull()
      const pane = container.querySelector<HTMLElement>('[data-slot="product-zoom"]')!
      expect(pane.style.backgroundImage).toContain('/products/blazer_nu_navy.webp')
      expect(pane.style.backgroundPosition).toBe('50% 50%')

      await user.unhover(trigger)
      expect(container.querySelector('[data-slot="product-lens"]')).toBeNull()
      expect(container.querySelector('[data-slot="product-zoom"]')).toBeNull()
    })

    it('is off unless requested', async () => {
      const user = userEvent.setup()
      const { container } = render(<ProductImage product={blazer} gender="FEMALE" colour="navy" sizes="96px" />)
      await user.hover(screen.getByRole('button', { name: /Phóng to ảnh/ }))
      expect(container.querySelector('[data-slot="product-lens"]')).toBeNull()
    })
  })
})
