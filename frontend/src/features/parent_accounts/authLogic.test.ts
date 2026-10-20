import { describe, expect, it } from 'vitest'
import { initialsOf, safeParentRedirect, toRegisterBody, validateLogin, validateRegister } from './authLogic'

const valid = { full_name: 'Nguyễn Thị Lan', email: 'lan@example.com', phone: '', password: 'matkhau123' }

describe('validateRegister', () => {
  it('accepts email only', () => {
    expect(validateRegister(valid)).toEqual({})
  })
  it('accepts phone only, with or without country code', () => {
    expect(validateRegister({ ...valid, email: '', phone: '0912 345 678' })).toEqual({})
    expect(validateRegister({ ...valid, email: '', phone: '+84912345678' })).toEqual({})
  })
  it('requires email or phone', () => {
    expect(validateRegister({ ...valid, email: ' ' }).email).toBeDefined()
  })
  it('rejects malformed email, phone and short password', () => {
    const errors = validateRegister({ ...valid, email: 'lan@', phone: '12', password: '1234567' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'password', 'phone'])
  })
  it('requires a name', () => {
    expect(validateRegister({ ...valid, full_name: '  ' }).full_name).toBeDefined()
  })
})

describe('toRegisterBody', () => {
  it('omits empty identifiers and trims', () => {
    expect(toRegisterBody({ ...valid, full_name: ' Lan ', phone: ' ' })).toEqual({
      full_name: 'Lan',
      email: 'lan@example.com',
      password: 'matkhau123',
    })
  })
})

describe('safeParentRedirect', () => {
  it('keeps parent paths with search', () => {
    expect(safeParentRedirect('/parent')).toBe('/parent')
    expect(safeParentRedirect('/parent/children/abc')).toBe('/parent/children/abc')
    expect(safeParentRedirect('/parent/children/new?x=1')).toBe('/parent/children/new?x=1')
  })
  it('rejects admin, external and protocol-relative targets', () => {
    expect(safeParentRedirect('/dashboard')).toBeUndefined()
    expect(safeParentRedirect('//evil.com')).toBeUndefined()
    expect(safeParentRedirect('/parentx')).toBeUndefined()
    expect(safeParentRedirect('https://evil.com/parent')).toBeUndefined()
    expect(safeParentRedirect(undefined)).toBeUndefined()
  })
})

describe('validateLogin', () => {
  it('requires both fields', () => {
    expect(Object.keys(validateLogin({ identifier: ' ', password: '' })).sort()).toEqual(['identifier', 'password'])
    expect(validateLogin({ identifier: 'lan@example.com', password: 'x' })).toEqual({})
  })
})

describe('initialsOf', () => {
  it('uses the first and last word, upper-cased with Vietnamese diacritics kept', () => {
    expect(initialsOf('Nguyễn Văn An')).toBe('NA')
    expect(initialsOf('  đỗ  lan ')).toBe('ĐL')
  })
  it('falls back to one letter for a single word and empty for blank', () => {
    expect(initialsOf('Lan')).toBe('L')
    expect(initialsOf('  ')).toBe('')
  })
})
