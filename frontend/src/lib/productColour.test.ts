import { describe, expect, it } from 'vitest'
import { colourLabel } from './productColour'

describe('colourLabel', () => {
  it('maps stored values to display names', () => {
    expect(colourLabel('navy')).toBe('Navy')
    expect(colourLabel('ghi')).toBe('Ghi')
  })
  it('returns null for legacy rows without a colour', () => {
    expect(colourLabel(null)).toBeNull()
    expect(colourLabel(undefined)).toBeNull()
  })
})
