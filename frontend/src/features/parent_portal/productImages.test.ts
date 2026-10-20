import { describe, expect, it } from 'vitest'
import { productImage } from './productImages'

describe('productImage', () => {
  it('maps product, gender and colour to the full and 900px webp sheets', () => {
    expect(productImage('blazer', 'MALE', 'navy')).toEqual({
      src: '/products/blazer_nam_navy.webp',
      thumb: '/products/blazer_nam_navy_900.webp',
      srcSet: '/products/blazer_nam_navy_900.webp 900w, /products/blazer_nam_navy.webp 1600w',
    })
    expect(productImage('gile', 'FEMALE', 'ghi')?.src).toBe('/products/gile_nu_ghi.webp')
  })
  it('returns null for products without a sheet', () => {
    expect(productImage('cravat', 'MALE', 'navy')).toBeNull()
  })
})
