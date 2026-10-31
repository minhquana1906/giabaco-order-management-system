import { describe, expect, it } from 'vitest'
import {
  initialsOf,
  passwordCriteria,
  safeParentRedirect,
  toRegisterBody,
  validateForgot,
  validateLogin,
  validateRegister,
} from './authLogic'

const valid = {
  full_name: 'Nguyễn Thị Lan',
  email: 'lan@example.com',
  phone: '0912 345 678',
  password: 'matkhau123',
  confirm_password: 'matkhau123',
}

describe('validateRegister', () => {
  it('accepts a complete form', () => {
    expect(validateRegister(valid)).toEqual({})
  })
  it('requires an email', () => {
    expect(validateRegister({ ...valid, email: ' ' }).email).toBe('Vui lòng nhập email.')
  })
  it('accepts a phone with country code', () => {
    expect(validateRegister({ ...valid, phone: '+84912345678' })).toEqual({})
  })
  it('requires a phone', () => {
    expect(validateRegister({ ...valid, phone: ' ' }).phone).toBeDefined()
  })
  it('rejects malformed email, phone and short password', () => {
    const errors = validateRegister({
      ...valid,
      email: 'lan@',
      phone: '12',
      password: '1234567',
      confirm_password: '1234567',
    })
    expect(Object.keys(errors).sort()).toEqual(['email', 'password', 'phone'])
  })
  it('requires the confirmation to match the password', () => {
    expect(validateRegister({ ...valid, confirm_password: 'matkhau124' }).confirm_password).toBe(
      'Mật khẩu xác nhận chưa giống. Nhập lại đúng mật khẩu ở ô trên.',
    )
  })
  it('requires a name', () => {
    expect(validateRegister({ ...valid, full_name: '  ' }).full_name).toBeDefined()
  })
})

describe('toRegisterBody', () => {
  it('trims fields and drops the confirmation', () => {
    expect(
      toRegisterBody({ ...valid, full_name: ' Lan ', phone: ' 0912345678 ', email: ' lan@example.com ' }),
    ).toEqual({
      full_name: 'Lan',
      phone: '0912345678',
      email: 'lan@example.com',
      password: 'matkhau123',
    })
  })
})

describe('validateForgot', () => {
  it('requires a well-formed email', () => {
    expect(validateForgot(' ')).toBe('Vui lòng nhập email.')
    expect(validateForgot('lan@')).toBe('Email chưa đúng. Ví dụ: ten@gmail.com.')
    expect(validateForgot(' lan@example.com ')).toBeUndefined()
  })
})

describe('passwordCriteria', () => {
  it('tracks length and confirmation separately', () => {
    expect(passwordCriteria('1234567', '1234567')).toEqual({ longEnough: false, matches: true })
    expect(passwordCriteria('12345678', '')).toEqual({ longEnough: true, matches: false })
    expect(passwordCriteria('12345678', '12345678')).toEqual({ longEnough: true, matches: true })
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
