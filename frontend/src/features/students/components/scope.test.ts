import { describe, expect, it } from 'vitest'
import type { Product } from '@/features/catalog/api'
import { newRow } from './formLogic'
import { detailProducts, formProducts, pickByCodes } from './scope'
import type { StudentDetail } from '../api'

const p = (code: string) => ({ code, name: code.toUpperCase() }) as Product

describe('formProducts', () => {
  const all = [p('blazer'), p('gile'), p('vest')]
  it('returns only the profile when nothing is recorded', () => {
    expect(formProducts([p('blazer')], all, []).map((x) => x.code)).toEqual(['blazer'])
  })
  it('keeps profile order and appends recorded products outside it', () => {
    expect(formProducts([p('gile'), p('blazer')], all, ['vest', 'blazer']).map((x) => x.code)).toEqual([
      'gile',
      'blazer',
      'vest',
    ])
  })
  it('is empty for an empty profile with no records', () => {
    expect(formProducts([], all, [])).toEqual([])
  })
})

describe('pickByCodes', () => {
  it('drops products outside the codes', () => {
    expect(pickByCodes({ blazer: '3', vest: '2' }, ['blazer'])).toEqual({ blazer: '3' })
    const rows = [newRow()]
    expect(pickByCodes({ blazer: rows, vest: rows }, ['vest'])).toEqual({ vest: rows })
  })
})

describe('detailProducts', () => {
  const trials = [
    { product_code: 'vest', product_name: 'Vest' },
    { product_code: 'vest', product_name: 'Vest' },
    { product_code: 'blazer', product_name: 'Blazer' },
  ] as StudentDetail['trials']
  it('lists the profile first, then recorded products outside it once', () => {
    expect(detailProducts([{ code: 'blazer', name: 'Blazer' }], trials)).toEqual([
      { code: 'blazer', name: 'Blazer' },
      { code: 'vest', name: 'Vest' },
    ])
  })
  it('falls back to recorded products while the profile is loading', () => {
    expect(detailProducts([], trials).map((x) => x.code)).toEqual(['vest', 'blazer'])
  })
})
