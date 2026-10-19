import { describe, expect, it } from 'vitest'
import { topicsToQueryKeys } from './topics'

const ALL = [['students'], ['stats']]

describe('topicsToQueryKeys', () => {
  it('maps choices to students and stats', () => {
    expect(topicsToQueryKeys('{"topics":["choices"]}')).toEqual(ALL)
  })
  it('dedupes keys across topics', () => {
    expect(topicsToQueryKeys('{"topics":["choices","students"]}')).toEqual(ALL)
  })
  it('falls back to broad invalidation on garbage or unknown topics', () => {
    expect(topicsToQueryKeys('nope')).toEqual(ALL)
    expect(topicsToQueryKeys('{"topics":[]}')).toEqual(ALL)
    expect(topicsToQueryKeys('{"topics":["x"]}')).toEqual(ALL)
  })
})
