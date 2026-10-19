import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProductImageButton } from './ProductImageButton'

const blazer = { code: 'blazer', name: 'Áo Blazer', sizes: ['1', '2'] }

describe('ProductImageButton', () => {
  it('renders nothing for a product without a sheet', () => {
    const { container } = render(<ProductImageButton product={{ ...blazer, code: 'cravat' }} gender="MALE" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads no image until opened, then shows the student gender sheet and switches colour', async () => {
    const user = userEvent.setup()
    render(<ProductImageButton product={blazer} gender="FEMALE" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xem ảnh sản phẩm' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/products/blazer_nu_navy.jpg')
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')

    await user.click(screen.getByLabelText('Ghi'))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/products/blazer_nu_ghi.jpg')
    expect(screen.getByRole('link', { name: /Mở ảnh lớn/ })).toHaveAttribute('href', '/products/blazer_nu_ghi.jpg')
  })
})
