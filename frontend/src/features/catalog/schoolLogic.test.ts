import { describe, expect, it } from 'vitest'
import { defaultSchool } from './schoolLogic'

const school = (id: string, has_open_campaign: boolean) => ({ id, has_open_campaign })

describe('defaultSchool', () => {
  it('prefers the school with an open campaign', () => {
    expect(defaultSchool([school('a', false), school('b', true)])?.id).toBe('b')
  })
  it('two schools with OPEN campaign -> first in list order', () => {
    expect(defaultSchool([school('a', true), school('b', true)])?.id).toBe('a')
  })
  it('falls back to the first school', () => {
    expect(defaultSchool([school('a', false), school('b', false)])?.id).toBe('a')
  })
  it('returns undefined for no schools', () => {
    expect(defaultSchool([])).toBeUndefined()
  })
})
