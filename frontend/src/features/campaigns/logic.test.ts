import { describe, expect, it } from 'vitest'
import { defaultCampaignId, kitPrice, parsePrice, slugify, suggestOption, uniqueKitCode } from './logic'

describe('kitPrice', () => {
  it('sums qty times unit price over the chosen options', () => {
    const prices = { shirt: 100_000, shorts: 50_000 }
    expect(
      kitPrice(
        [
          { qty: 2, productId: 'shirt' },
          { qty: 1, productId: 'shorts' },
        ],
        prices,
      ),
    ).toBe(250_000)
  })
  it('is null when any chosen option has no price', () => {
    const selection = [
      { qty: 1, productId: 'shirt' },
      { qty: 1, productId: 'skirt' },
    ]
    expect(kitPrice(selection, { shirt: 100_000, skirt: null })).toBeNull()
    expect(kitPrice(selection, { shirt: 100_000 })).toBeNull()
  })
})

describe('suggestOption', () => {
  const genders = { shorts: 'MALE', skirt: 'FEMALE' }
  it('prefers the option that targets the student gender', () => {
    expect(suggestOption(['shorts', 'skirt'], genders, 'FEMALE')).toBe('skirt')
  })
  it('falls back to the first option', () => {
    expect(suggestOption(['shorts', 'skirt'], genders, null)).toBe('shorts')
    expect(suggestOption(['a', 'b'], { a: 'UNISEX', b: 'UNISEX' }, 'FEMALE')).toBe('a')
  })
})

describe('kit codes', () => {
  it('strips Vietnamese diacritics', () => {
    expect(slugify('Bộ hè Đồng phục')).toBe('bo_he_dong_phuc')
  })
  it('keeps codes unique and at least two characters', () => {
    expect(uniqueKitCode('Bộ hè', ['bo_he'])).toBe('bo_he_2')
    expect(uniqueKitCode('A', [])).toBe('a_')
  })
})

describe('parsePrice', () => {
  it('keeps digits only and maps empty to null', () => {
    expect(parsePrice('1.250.000 đ')).toBe(1_250_000)
    expect(parsePrice('')).toBeNull()
  })
})

describe('defaultCampaignId', () => {
  const c = (id: string, status: string, opens_at: string) => ({ id, status, opens_at })

  it('prefers the open campaign, else the newest non-draft, else the newest', () => {
    expect(defaultCampaignId([c('a', 'LOCKED', '2026-01-01'), c('b', 'OPEN', '2025-01-01')])).toBe('b')
    expect(defaultCampaignId([c('d', 'DRAFT', '2026-09-01'), c('a', 'LOCKED', '2026-06-01')])).toBe('a')
    expect(defaultCampaignId([c('d1', 'DRAFT', '2026-01-01'), c('d2', 'DRAFT', '2026-02-01')])).toBe('d2')
    expect(defaultCampaignId([])).toBeUndefined()
  })
})
