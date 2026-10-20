import { describe, expect, it } from 'vitest'
import { canContinue, derivedSize, initialPicks, initialStep, missingColours, pickChanges, suggestionFor } from './choices'

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

describe('suggestionFor', () => {
  const declared = { data_source: 'PARENT_DECLARED' as const, trials: [], suggested_sizes: { blazer: '3', gile: null } }
  it('uses the size chart suggestion for a declared record', () => {
    expect(suggestionFor(blazer, declared)).toEqual({ size: '3', source: 'chart' })
    expect(suggestionFor(gile, declared)).toBeNull()
  })
  it('prefers the size staff saw fitting and ignores the chart for measured records', () => {
    const measured = { data_source: 'ADMIN_MEASURED' as const, trials: [trial('2', 'FITS')], suggested_sizes: { blazer: '4' } }
    expect(suggestionFor(blazer, measured)).toEqual({ size: '2', source: 'trial' })
    expect(suggestionFor(blazer, { ...measured, trials: [] })).toBeNull()
  })
  it('drops a chart size the product does not offer', () => {
    expect(suggestionFor(blazer, { ...declared, suggested_sizes: { blazer: '9' } })).toBeNull()
  })
})

describe('initialPicks', () => {
  it('leaves every product unanswered when nothing is saved and nothing is suggested', () => {
    expect(initialPicks(products, {})).toEqual({ blazer: undefined, gile: undefined })
  })
  it('preselects the suggested size without a colour when nothing is saved', () => {
    expect(initialPicks(products, {}, { blazer: { size: '3', source: 'chart' }, gile: null })).toEqual({
      blazer: { size_label: '3', colour: null },
      gile: undefined,
    })
  })
  it('lets a saved choice win over the suggestion and keeps a legacy null colour unselected', () => {
    const suggested = { blazer: { size: '4', source: 'chart' as const }, gile: { size: '2', source: 'chart' as const } }
    expect(initialPicks(products, { blazer: { size_label: '3', colour: null } }, suggested)).toEqual({
      blazer: { size_label: '3', colour: null },
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
  it('treats a legacy choice as changed once a colour is picked and never emits a colourless pick', () => {
    const legacy = { blazer: { size_label: '3', colour: null } }
    expect(pickChanges(products, { blazer: { size_label: '3', colour: 'navy' }, gile: null }, legacy)).toEqual({
      blazer: { size_label: '3', colour: 'navy' },
    })
    expect(pickChanges(products, { blazer: { size_label: '3', colour: null }, gile: null }, legacy)).toEqual({})
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

describe('canContinue', () => {
  const sized = { size_label: '3', colour: null }
  it('stays enabled while a picked size has no colour so the missing colour can be flagged', () => {
    expect(missingColours(products, { blazer: sized, gile: null })).toEqual(['blazer'])
    expect(canContinue(products, { blazer: sized, gile: null }, {})).toBe(true)
    expect(canContinue(products, { blazer: sized, gile: null }, { blazer: { size_label: '3', colour: null } })).toBe(true)
  })
  it('ignores colour for a product that is not registered', () => {
    expect(missingColours(products, { blazer: null, gile: undefined })).toEqual([])
  })
  it('needs every product answered and at least one change', () => {
    const picked = { size_label: '3', colour: 'navy' as const }
    expect(canContinue(products, { blazer: picked, gile: undefined }, {})).toBe(false)
    expect(canContinue(products, { blazer: null, gile: null }, {})).toBe(false)
    expect(canContinue(products, { blazer: picked, gile: null }, { blazer: picked })).toBe(false)
    expect(canContinue(products, { blazer: null, gile: null }, { blazer: picked })).toBe(true)
  })
})
