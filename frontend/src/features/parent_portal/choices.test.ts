import { describe, expect, it } from 'vitest'
import { derivedSize, initialPicks, initialStep, pickChanges } from './choices'

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

const blazer = product
const gile = { code: 'gile', name: 'Áo Gile', sizes: ['1', '2', '3', '4'] }
const products = [blazer, gile]

describe('initialPicks', () => {
  it('leaves every product unanswered when nothing is saved', () => {
    expect(initialPicks(products, {})).toEqual({ blazer: undefined, gile: undefined })
  })
  it('prefills saved choices, defaults a legacy null colour to navy and marks the rest as skipped', () => {
    expect(initialPicks(products, { blazer: { size_label: '3', colour: null } })).toEqual({
      blazer: { size_label: '3', colour: 'navy' },
      gile: null,
    })
    expect(initialPicks(products, { blazer: { size_label: '3', colour: 'ghi' } }).blazer).toEqual({
      size_label: '3',
      colour: 'ghi',
    })
  })
})

describe('pickChanges', () => {
  const saved = { blazer: { size_label: '3', colour: 'navy' as const } }
  it('is empty when size and colour match what is saved', () => {
    expect(pickChanges(products, { blazer: { size_label: '3', colour: 'navy' }, gile: null }, saved)).toEqual({})
  })
  it('detects a colour-only change', () => {
    expect(pickChanges(products, { blazer: { size_label: '3', colour: 'ghi' }, gile: null }, saved)).toEqual({
      blazer: { size_label: '3', colour: 'ghi' },
    })
  })
  it('requires re-confirming a legacy choice that has no colour', () => {
    expect(
      pickChanges(products, { blazer: { size_label: '3', colour: 'navy' }, gile: null }, { blazer: { size_label: '3', colour: null } }),
    ).toEqual({ blazer: { size_label: '3', colour: 'navy' } })
  })
  it('removes a saved product that is now skipped and ignores skipped unsaved ones', () => {
    expect(pickChanges(products, { blazer: null, gile: null }, saved)).toStrictEqual({ blazer: undefined })
  })
  it('adds a newly picked product', () => {
    expect(
      pickChanges(products, { blazer: { size_label: '3', colour: 'navy' }, gile: { size_label: '2', colour: 'ghi' } }, saved),
    ).toEqual({ gile: { size_label: '2', colour: 'ghi' } })
  })
})
