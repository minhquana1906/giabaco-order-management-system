import { sizeColor, sizeTextColor } from './sizes'

describe('sizeColor', () => {
  it('runs from the lightest tint to deep navy for any catalog length', () => {
    for (const count of [2, 5, 7, 9]) {
      expect(sizeColor(0, count)).toBe('#c5d0e6')
      expect(sizeColor(count - 1, count)).toBe('#1b2b4b')
    }
  })

  it('darkens monotonically and tolerates a single size', () => {
    const reds = Array.from({ length: 7 }, (_, i) => parseInt(sizeColor(i, 7).slice(1, 3), 16))
    expect(reds).toEqual([...reds].sort((a, b) => b - a))
    expect(sizeColor(0, 1)).toBe('#c5d0e6')
  })

  it('picks ink on light steps and white on dark steps', () => {
    expect(sizeTextColor(0, 7)).toBe('#16203a')
    expect(sizeTextColor(6, 7)).toBe('#ffffff')
  })
})
