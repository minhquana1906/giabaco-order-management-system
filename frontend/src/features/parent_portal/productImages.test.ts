import { describe, expect, it } from 'vitest'
import { lensAt, productImage } from './productImages'

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

describe('lensAt', () => {
  const rect = { left: 100, top: 50, width: 300, height: 200 }
  it('sizes the lens so the zoom fills a pane as tall as the image', () => {
    const lens = lensAt(250, 150, rect, 600)
    expect(lens.height).toBeCloseTo(0.3)
    expect(lens.paneWidth).toBe(600)
  })
  it('centres the lens on the pointer in the middle', () => {
    const { x, y } = lensAt(250, 150, rect, 600)
    expect(x).toBeCloseTo(0.5)
    expect(y).toBeCloseTo(0.5)
  })
  it('clamps the lens inside the image near the edges', () => {
    expect(lensAt(100, 50, rect, 600)).toMatchObject({ x: 0, y: 0 })
    expect(lensAt(400, 250, rect, 600)).toMatchObject({ x: 1, y: 1 })
    expect(lensAt(0, 0, rect, 600)).toMatchObject({ x: 0, y: 0 })
  })
})
