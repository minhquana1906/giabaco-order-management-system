import { describe, expect, it } from 'vitest'
import { lensTravel, productImage } from './productImages'

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

describe('lensTravel', () => {
  const rect = { left: 100, top: 50, width: 300, height: 200 }
  it('maps the pointer to the lens travel range, centred in the middle', () => {
    expect(lensTravel(250, 150, rect)).toEqual({ x: 0.5, y: 0.5 })
  })
  it('clamps the lens inside the image near the edges', () => {
    expect(lensTravel(100, 50, rect)).toEqual({ x: 0, y: 0 })
    expect(lensTravel(400, 250, rect)).toEqual({ x: 1, y: 1 })
    expect(lensTravel(0, 0, rect)).toEqual({ x: 0, y: 0 })
  })
})
