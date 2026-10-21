import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductImageOrPlaceholder, ProductImagePlaceholder } from './ProductImagePlaceholder'

describe('ProductImageOrPlaceholder', () => {
  it('shows the placeholder text when image is null', () => {
    render(<ProductImageOrPlaceholder image={null} alt="Áo Blazer nữ" />)
    expect(screen.getByText('Chưa có thông tin ảnh sản phẩm')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Áo Blazer nữ' })).not.toBeInTheDocument()
  })

  it('shows the image when present', () => {
    render(<ProductImageOrPlaceholder image={{ url: '/media/products/a.png', width: 30, height: 40 }} alt="Áo Blazer nam" />)
    expect(screen.getByRole('img', { name: 'Áo Blazer nam' })).toHaveAttribute('src', '/media/products/a.png')
    expect(screen.queryByText('Chưa có thông tin ảnh sản phẩm')).not.toBeInTheDocument()
  })

  it('keeps the frame ratio of a real image', () => {
    render(<ProductImagePlaceholder aspect={0.75} />)
    expect(screen.getByRole('img', { name: 'Chưa có thông tin ảnh sản phẩm' })).toHaveStyle({ aspectRatio: '0.75' })
  })
})
