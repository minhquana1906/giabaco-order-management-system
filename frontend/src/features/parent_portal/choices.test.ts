import { describe, expect, it } from 'vitest'
import { derivedSize, initialStep } from './choices'

const product = { code: 'blazer', name: 'Áo Blazer', sizes: ['1', '2', '3', '4'] }
const trial = (size_label: string, fit: 'FITS' | 'TOO_TIGHT' | 'TOO_LOOSE', product_code = 'blazer') => ({
  product_code,
  product_name: '',
  size_label,
  fit,
})

describe('derivedSize', () => {
  it('picks the largest FITS size by product order', () => {
    expect(derivedSize(product, [trial('3', 'FITS'), trial('2', 'FITS'), trial('4', 'TOO_LOOSE')])).toBe('3')
  })
  it('ignores other products and non-fitting trials', () => {
    expect(derivedSize(product, [trial('2', 'TOO_TIGHT'), trial('4', 'FITS', 'gile')])).toBeNull()
  })
})

describe('initialStep', () => {
  it('asks for identity first on the QR flow', () => {
    expect(initialStep(false, false)).toBe('identity')
  })
  it('starts at measurements when identity is skipped', () => {
    expect(initialStep(false, true)).toBe('measure')
  })
  it('shows the overview once choices exist', () => {
    expect(initialStep(true, false)).toBe('overview')
    expect(initialStep(true, true)).toBe('overview')
  })
})
