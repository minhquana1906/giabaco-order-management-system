import { describe, expect, it } from 'vitest'
import { productImageSrc } from './productImages'

describe('productImageSrc', () => {
  it('maps product, gender and colour to the sheet file', () => {
    expect(productImageSrc('blazer', 'MALE', 'navy')).toBe('/products/blazer_nam_navy.jpg')
    expect(productImageSrc('gile', 'FEMALE', 'ghi')).toBe('/products/gile_nu_ghi.jpg')
  })
  it('returns null for products without a sheet', () => {
    expect(productImageSrc('cravat', 'MALE', 'navy')).toBeNull()
  })
})
