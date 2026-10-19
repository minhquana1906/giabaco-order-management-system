import { describe, expect, it } from 'vitest'
import { dobFromIso, dobToIso, EMPTY_DOB } from './dob'

describe('dobToIso', () => {
  it('pads and joins a valid date', () => {
    expect(dobToIso({ day: '4', month: '3', year: '2018' })).toBe('2018-03-04')
  })
  it('rejects incomplete, impossible and future dates', () => {
    expect(dobToIso({ day: '', month: '3', year: '2018' })).toBeNull()
    expect(dobToIso({ day: '31', month: '2', year: '2018' })).toBeNull()
    expect(dobToIso({ day: '1', month: '1', year: String(new Date().getFullYear() + 1) })).toBeNull()
  })
})

describe('dobFromIso', () => {
  it('splits an ISO date and drops leading zeros', () => {
    expect(dobFromIso('2018-03-04')).toEqual({ day: '4', month: '3', year: '2018' })
  })
  it('returns empty parts for empty input', () => {
    expect(dobFromIso('')).toEqual(EMPTY_DOB)
  })
})
