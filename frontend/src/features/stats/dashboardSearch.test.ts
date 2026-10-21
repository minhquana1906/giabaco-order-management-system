import { describe, expect, it } from 'vitest'
import { dashboardParams, parseDashboardSearch, patchSearch, withSchool } from './dashboardSearch'

const full = parseDashboardSearch({
  school_id: 's1',
  view: 'orders',
  product: 'blazer',
  campaign_id: 'c1',
  group: 'class',
  gender: 'female',
  measure: 'amount',
  until: '2026-07-03',
})

describe('dashboard search', () => {
  it('keeps valid values and drops invalid or default ones', () => {
    expect(full).toEqual({
      school_id: 's1',
      view: 'orders',
      product: 'blazer',
      campaign_id: 'c1',
      group: 'class',
      gender: 'female',
      measure: 'amount',
      until: '2026-07-03',
    })
    expect(
      parseDashboardSearch({ view: 'measure', group: 'product', gender: 'all', measure: 'qty', until: 'soon' }),
    ).toEqual({
      school_id: undefined,
      view: undefined,
      product: undefined,
      campaign_id: undefined,
      group: undefined,
      gender: undefined,
      measure: undefined,
      until: undefined,
    })
  })

  it('applies defaults when reading params', () => {
    expect(dashboardParams({})).toMatchObject({ view: 'measure', group: 'product', gender: 'all', measure: 'qty' })
  })

  it('preserves every other param when switching view, product or filters', () => {
    expect(patchSearch(full, { view: 'measure' })).toEqual({ ...full, view: undefined })
    expect(patchSearch(full, { product: 'gile' })).toEqual({ ...full, product: 'gile' })
    expect(patchSearch(full, { gender: 'all' })).toEqual({ ...full, gender: undefined })
  })

  it('clears product and campaign when the school changes', () => {
    expect(withSchool(full, 's2')).toEqual({ ...full, school_id: 's2', product: undefined, campaign_id: undefined })
  })
})
