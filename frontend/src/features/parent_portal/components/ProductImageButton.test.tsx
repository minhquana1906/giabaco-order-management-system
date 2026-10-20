import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProductImageButton } from './ProductImageButton'

const blazer = { code: 'blazer', name: 'Áo Blazer', sizes: ['1', '2'] }

describe('ProductImageButton', () => {
  it('renders nothing for a product without a sheet', () => {
    const { container } = render(<ProductImageButton product={{ ...blazer, code: 'cravat' }} gender="MALE" colour="navy" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads no image until opened, then shows the sheet for the student gender and given colour', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ProductImageButton product={blazer} gender="FEMALE" colour="navy" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xem ảnh sản phẩm' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/products/blazer_nu_navy.jpg')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    rerender(<ProductImageButton product={blazer} gender="FEMALE" colour="ghi" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/products/blazer_nu_ghi.jpg')
    expect(screen.getByRole('link', { name: /Mở ảnh lớn/ })).toHaveAttribute('href', '/products/blazer_nu_ghi.jpg')
  })
})
