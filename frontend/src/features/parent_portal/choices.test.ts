import { describe, expect, it } from 'vitest'
import type { Kit, KitOption, LooseItem, Ordering, PublicStudent } from './api'
import {
  buildPayload,
  clampQty,
  derivedSize,
  draftProblems,
  estimateTotal,
  formatPrice,
  hasSplitLines,
  initialDraft,
  initialStep,
  needsColourChoice,
  orderingMode,
  reviewRows,
  suggestionFor,
} from './choices'

const trial = (size_label: string, fit: 'FITS' | 'TOO_TIGHT' | 'TOO_LOOSE', product_code = 'blazer') => ({
  product_code,
  product_name: '',
  size_label,
  fit,
})

const option = (id: string, patch: Partial<KitOption> = {}): KitOption => ({
  product_id: id,
  code: id,
  name: id,
  sizes: ['1', '2', '3', '4'],
  colours: [{ code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }],
  image: null,
  suggested: false,
  ...patch,
})

const kit: Kit = {
  id: 'k1',
  name: 'Bộ Blazer',
  price: 500000,
  image: null,
  slots: [
    { id: 's1', label: 'Áo', qty: 1, options: [option('blazer')] },
    {
      id: 's2',
      label: 'Gile',
      qty: 1,
      options: [option('gile_nam'), option('gile_nu', { suggested: true })],
    },
  ],
}

const loose: LooseItem = {
  product_id: 'cap',
  code: 'cap',
  name: 'Mũ',
  price: null,
  sizes: ['S', 'M'],
  colours: [{ code: 'navy', label: 'Navy', hex: '#1b2b4b' }, { code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }],
  image: null,
}

const student = (patch: Partial<PublicStudent> = {}): PublicStudent => ({
  full_name: 'An',
  school_name: 'A',
  class_name: '1A',
  gender: 'FEMALE',
  data_source: 'ADMIN_MEASURED',
  height_cm: null,
  weight_kg: null,
  measured_at: null,
  trials: [],
  products: [],
  suggested_sizes: {},
  ...patch,
})

const ordering = (patch: Partial<Ordering> = {}): Ordering => ({
  campaign: { id: 'c', name: 'Đợt 1', status: 'OPEN', closes_at: null },
  kits: [kit],
  items: [loose],
  suggested_sizes: {},
  order: null,
  ...patch,
})

describe('derivedSize', () => {
  it('picks the largest FITS size by product order', () => {
    const p = { code: 'blazer', sizes: ['1', '2', '3', '4'] }
    expect(derivedSize(p, [trial('3', 'FITS'), trial('2', 'FITS'), trial('4', 'TOO_LOOSE')])).toBe('3')
    expect(derivedSize(p, [trial('2', 'TOO_TIGHT'), trial('4', 'FITS', 'gile')])).toBeNull()
  })
})

describe('initialStep', () => {
  it('goes by identity, then measurements, then the overview once an order exists', () => {
    expect(initialStep(false, false)).toBe('identity')
    expect(initialStep(false, true)).toBe('measure')
    expect(initialStep(true, false)).toBe('overview')
  })
})

describe('suggestionFor', () => {
  const p = { code: 'blazer', sizes: ['1', '2', '3'] }
  it('prefers the measured size, then the chart only for declared profiles', () => {
    expect(suggestionFor(p, student({ trials: [trial('2', 'FITS')], suggested_sizes: { blazer: '3' } }))).toEqual({
      size: '2',
      source: 'trial',
    })
    expect(suggestionFor(p, student({ data_source: 'PARENT_DECLARED', suggested_sizes: { blazer: '3' } }))).toEqual({
      size: '3',
      source: 'chart',
    })
    expect(suggestionFor(p, student({ suggested_sizes: { blazer: '3' } }))).toBeNull()
  })
})

describe('initialDraft', () => {
  it('defaults slots to the suggested option and the kit size to the suggestion', () => {
    const d = initialDraft(ordering(), student({ trials: [trial('2', 'FITS')] }))
    expect(d.kits.k1).toMatchObject({ qty: 0, size: '2' })
    expect(d.kits.k1!.slots.s2!.productId).toBe('gile_nu')
    expect(d.kits.k1!.slots.s1!.colour).toBe('ghi')
    expect(d.items.cap).toMatchObject({ qty: 0, colour: null })
  })

  it('restores a saved order and detects per-slot size overrides', () => {
    const order = {
      id: 'o',
      code: 'X',
      status: 'SUBMITTED',
      total: 0,
      has_unpriced: false,
      submitted_at: null,
      kit_lines: [
        {
          kit_id: 'k1',
          qty: 2,
          size_label: '2',
          slots: [
            { slot_id: 's1', product_id: 'blazer', size_label: '2', colour: 'ghi' },
            { slot_id: 's2', product_id: 'gile_nam', size_label: '3', colour: 'ghi' },
          ],
        },
      ],
      item_lines: [],
    }
    const d = initialDraft(ordering({ order }), student())
    expect(d.kits.k1).toMatchObject({ qty: 2, size: '2' })
    expect(d.kits.k1!.slots.s1!.size).toBeNull()
    expect(d.kits.k1!.slots.s2).toMatchObject({ productId: 'gile_nam', size: '3' })
  })
})

describe('buildPayload', () => {
  const o = ordering()
  it('skips zero quantities', () => {
    const d = initialDraft(o, student())
    expect(buildPayload(o, d)).toEqual({ kit_lines: [], item_lines: [] })
  })

  it('writes slot options, inherits the common size and honours per-slot overrides', () => {
    const d = initialDraft(o, student())
    d.kits.k1 = {
      ...d.kits.k1!,
      qty: 2,
      size: '2',
      slots: { ...d.kits.k1!.slots, s2: { productId: 'gile_nam', size: '4', colour: 'ghi' } },
    }
    d.items.cap = { qty: 1, size: 'M', colour: 'navy' }
    expect(buildPayload(o, d)).toMatchObject({
      kit_lines: [
        {
          kit_id: 'k1',
          qty: 2,
          size_label: '2',
          slots: [
            { slot_id: 's1', product_id: 'blazer', size_label: '2', colour: 'ghi' },
            { slot_id: 's2', product_id: 'gile_nam', size_label: '4', colour: 'ghi' },
          ],
        },
      ],
      item_lines: [{ product_id: 'cap', size_label: 'M', colour: 'navy', qty: 1 }],
    })
  })
})

describe('draftProblems', () => {
  const o = ordering()
  it('flags an empty draft, a missing size and a missing colour only where there is a choice', () => {
    const d = initialDraft(o, student())
    expect(draftProblems(o, d)).toEqual(['empty'])
    d.kits.k1 = { ...d.kits.k1!, qty: 1 }
    d.items.cap = { qty: 1, size: 'S', colour: null }
    expect(draftProblems(o, d)).toEqual(['kit:k1', 'slot:s1', 'slot:s2', 'item-colour:cap'])
    d.kits.k1 = { ...d.kits.k1, size: '2' }
    d.items.cap = { qty: 1, size: 'S', colour: 'ghi' }
    expect(draftProblems(o, d)).toEqual([])
  })

  it('rejects a size the chosen option does not offer', () => {
    const d = initialDraft(o, student())
    d.kits.k1 = { ...d.kits.k1!, qty: 1, size: '9' }
    expect(draftProblems(o, d)).toContain('slot:s1')
  })

  it('requires configured measurements and preserves a saved snapshot and note', () => {
    const field = { key: 'chest', label: 'Ngực', instruction: '', required: true }
    const o = ordering({ items: [{ ...loose, tailor_measurements: [field] }] })
    const d = initialDraft(o, student())
    d.items.cap = { qty: 2, size: null, colour: 'ghi', is_tailor: true, measurements: {}, note: 'Rộng' }
    expect(draftProblems(o, d)).toContain('item:cap')
    d.items.cap.measurements = { chest: 501 }
    expect(draftProblems(o, d)).toContain('item:cap')
    d.items.cap.measurements = { chest: 500 }
    expect(draftProblems(o, d)).toEqual([])
    d.items.cap.measurements = { chest: 70 }
    expect(draftProblems(o, d)).toEqual([])
    expect(buildPayload(o, d).item_lines[0]).toMatchObject({ qty: 2, is_tailor: true, measurements: { chest: 70 }, note: 'Rộng' })
    expect(draftProblems(ordering({ items: [loose] }), d)).toContain('item:cap')
    d.items.cap.line_id = 'saved'
    d.items.cap.tailor_measurements = [field]
    expect(draftProblems(ordering({ items: [loose] }), d)).toEqual([])
  })
})

describe('estimateTotal', () => {
  const o = ordering({ items: [loose, { ...loose, product_id: 'sock', price: 20000 }] })
  it('multiplies price by quantity and reports unpriced lines', () => {
    const lines = {
      kit_lines: [{ kit_id: 'k1', qty: 2, size_label: '2', slots: [] }],
      item_lines: [{ product_id: 'sock', size_label: 'S', colour: null, qty: 3 }],
    }
    expect(estimateTotal(o, lines)).toEqual({ total: 1060000, hasUnpriced: false })
    const withCap = { ...lines, item_lines: [...lines.item_lines, { product_id: 'cap', size_label: 'S', colour: 'ghi', qty: 1 }] }
    expect(estimateTotal(o, withCap)).toEqual({ total: 1060000, hasUnpriced: true })
  })
})

describe('reviewRows', () => {
  it('resolves names, slot parts and amounts', () => {
    const rows = reviewRows(ordering(), {
      kit_lines: [
        {
          kit_id: 'k1',
          qty: 2,
          size_label: '2',
          slots: [{ slot_id: 's2', product_id: 'gile_nu', size_label: '3', colour: 'ghi' }],
        },
      ],
      item_lines: [{ product_id: 'cap', size_label: 'S', colour: 'navy', qty: 1 }],
    })
    expect(rows[0]).toMatchObject({ name: 'Bộ Blazer', amount: 1000000, parts: [{ label: 'Gile', name: 'gile_nu', size: '3' }] })
    expect(rows[1]).toMatchObject({
      name: 'Mũ',
      amount: null,
      unitPrice: null,
      colour: { code: 'navy', label: 'Navy', hex: '#1b2b4b' },
    })
  })
})

describe('hasSplitLines', () => {
  const line = (product_id: string, size_label: string) => ({ product_id, size_label, colour: 'ghi', qty: 1 })
  it('flags several lines for one product or one kit', () => {
    expect(hasSplitLines({ kit_lines: [], item_lines: [line('cap', 'S'), line('cap', 'M')] })).toBe(true)
    const kitLine = { kit_id: 'k1', qty: 1, size_label: '2', slots: [] }
    expect(hasSplitLines({ kit_lines: [kitLine, { ...kitLine, size_label: '3' }], item_lines: [] })).toBe(true)
  })
  it('accepts one line per product', () => {
    expect(hasSplitLines({ kit_lines: [], item_lines: [line('cap', 'S'), line('sock', 'S')] })).toBe(false)
  })
})

describe('misc', () => {
  it('shows a colour choice only for more than one colour', () => {
    expect(needsColourChoice([{ code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }])).toBe(false)
    expect(needsColourChoice([{ code: 'navy', label: 'Navy', hex: '#1b2b4b' }, { code: 'ghi', label: 'Ghi', hex: '#a3a9b3' }])).toBe(true)
  })
  it('clamps quantities to 0-10', () => {
    expect(clampQty(-1)).toBe(0)
    expect(clampQty(11)).toBe(10)
  })
  it('derives the ordering mode from the campaign', () => {
    expect(orderingMode({ campaign: null })).toBe('none')
    expect(orderingMode({ campaign: { id: 'c', name: '', status: 'LOCKED', closes_at: null } })).toBe('locked')
    expect(orderingMode(ordering())).toBe('open')
  })
  it('labels prices', () => {
    expect(formatPrice(null)).toBe('Giá đang cập nhật')
    expect(formatPrice(1000)).toBe('1.000 đ')
  })
})
