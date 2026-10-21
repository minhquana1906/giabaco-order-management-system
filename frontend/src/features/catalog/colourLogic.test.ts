import { describe, expect, it } from 'vitest'
import { colourLookup } from './colourLogic'

const options = [{ code: 'navy', label: 'Navy', hex: '#1b2b4b' }]

describe('colourLookup', () => {
  it('maps known codes to label and swatch', () => {
    const colours = colourLookup(options)
    expect(colours.label('navy')).toBe('Navy')
    expect(colours.swatch('navy')).toBe('#1b2b4b')
  })
  it('falls back to the code and a neutral swatch', () => {
    const colours = colourLookup(undefined)
    expect(colours.label('xanh')).toBe('xanh')
    expect(colours.swatch('xanh')).toBe('#d4d4d8')
  })
})
