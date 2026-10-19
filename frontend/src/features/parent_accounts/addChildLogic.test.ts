import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/http'
import {
  childErrorMessage,
  fieldErrorsFromApi,
  outcomeAfterClaimError,
  outcomeAfterCreateError,
  parseMeasure,
  stepAfterLookup,
  toCreateBody,
  toDeclaredBody,
  validateChildKey,
  validateDeclared,
} from './addChildLogic'

describe('stepAfterLookup', () => {
  it('goes to declare when no record matches', () => {
    expect(stepAfterLookup({ found: false })).toBe('declare')
  })
  it('asks the parent to confirm a single match', () => {
    expect(
      stepAfterLookup({ found: true, ambiguous: false, full_name: 'An', school_name: 'S', class_name: '1A' }),
    ).toBe('confirm')
  })
  it('sends ambiguous matches to Giabaco', () => {
    expect(stepAfterLookup({ found: true, ambiguous: true })).toBe('contact')
  })
})

describe('outcomeAfterClaimError', () => {
  it('maps ambiguous_match to contact and no_match back to search with a notice', () => {
    expect(outcomeAfterClaimError(new ApiError(409, 'ambiguous_match', 'x'))).toEqual({ step: 'contact', notice: null })
    const gone = outcomeAfterClaimError(new ApiError(404, 'no_match', 'x'))
    expect(gone?.step).toBe('search')
    expect(gone?.notice).toBeTruthy()
  })
  it('leaves other failures to the generic error message', () => {
    expect(outcomeAfterClaimError(new ApiError(429, 'rate_limited', 'x'))).toBeNull()
    expect(outcomeAfterClaimError(new Error('boom'))).toBeNull()
  })
})

describe('outcomeAfterCreateError', () => {
  it('returns to search when someone else created the child first', () => {
    const out = outcomeAfterCreateError(new ApiError(409, 'child_exists', 'x'))
    expect(out?.step).toBe('search')
    expect(out?.notice).toBeTruthy()
  })
  it('ignores unrelated failures', () => {
    expect(outcomeAfterCreateError(new ApiError(422, 'validation_error', 'x'))).toBeNull()
  })
})

describe('validateChildKey', () => {
  const ok = { school_id: 's1', full_name: 'Nguyễn Văn An', dob: '2018-03-14' }
  it('accepts a complete key', () => {
    expect(validateChildKey(ok, '2026-10-20')).toEqual({})
  })
  it('flags missing fields and future dates', () => {
    expect(Object.keys(validateChildKey({ school_id: '', full_name: ' ', dob: '' }, '2026-10-20')).sort()).toEqual([
      'dob',
      'full_name',
      'school_id',
    ])
    expect(validateChildKey({ ...ok, dob: '2030-01-01' }, '2026-10-20').dob).toBeDefined()
  })
})

describe('validateDeclared', () => {
  const ok = {
    class_id: 'c1',
    gender: 'MALE' as const,
    height: '126,5',
    weight: '24',
    parent_phone: '0912 345 678',
    parent_name: '',
    parent_email: '',
  }
  it('accepts comma decimals within range', () => {
    expect(validateDeclared(ok)).toEqual({})
    expect(parseMeasure('126,5')).toBe(126.5)
  })
  it('rejects values outside 90-190 cm and 10-90 kg, and empty fields', () => {
    const errors = validateDeclared({ ...ok, class_id: '', gender: '', height: '89', weight: '91', parent_phone: '' })
    expect(Object.keys(errors).sort()).toEqual(['class_id', 'gender', 'height', 'parent_phone', 'weight'])
    expect(validateDeclared({ ...ok, height: '190', weight: '10' })).toEqual({})
    expect(validateDeclared({ ...ok, height: 'abc' }).height).toBeDefined()
  })
  it('requires a valid parent phone and accepts +84 form', () => {
    expect(validateDeclared({ ...ok, parent_phone: '12345' }).parent_phone).toBeDefined()
    expect(validateDeclared({ ...ok, parent_phone: '+84912345678' })).toEqual({})
  })
  it('treats parent email as optional but validates it when given', () => {
    expect(validateDeclared({ ...ok, parent_email: 'lan@' }).parent_email).toBeDefined()
    expect(validateDeclared({ ...ok, parent_email: 'lan@example.com' })).toEqual({})
  })
})

describe('toCreateBody', () => {
  const ok = { class_id: 'c1', gender: 'MALE' as const, height: '126,5', weight: '24', parent_phone: '0912 345 678', parent_name: '', parent_email: '' }
  it('collapses name spacing and parses numbers', () => {
    expect(
      toCreateBody(
        { school_id: 's1', full_name: '  Nguyễn   Văn An ', dob: '2018-03-14' },
        toDeclaredBody({ ...ok, gender: 'FEMALE', parent_name: ' Lan ', parent_email: '' }),
      ),
    ).toEqual({
      school_id: 's1',
      full_name: 'Nguyễn Văn An',
      dob: '2018-03-14',
      class_id: 'c1',
      gender: 'FEMALE',
      height_cm: 126.5,
      weight_kg: 24,
      parent_phone: '0912 345 678',
      parent_name: 'Lan',
      parent_email: null,
    })
  })
})

describe('fieldErrorsFromApi', () => {
  it('reads 422 fields only', () => {
    expect(fieldErrorsFromApi(new ApiError(422, 'validation_error', 'x', { height_cm: 'bad' }))).toEqual({
      height_cm: 'bad',
    })
    expect(fieldErrorsFromApi(new ApiError(409, 'child_exists', 'x'))).toEqual({})
  })
})

describe('childErrorMessage', () => {
  const fieldsError = (fields: Record<string, string>) => new ApiError(422, 'validation_error', 'x', fields)

  it('shows the server message for the child limit and measured lock', () => {
    expect(childErrorMessage(new ApiError(409, 'child_limit', 'Tối đa 5 hồ sơ'), 'fb')).toBe('Tối đa 5 hồ sơ')
    expect(childErrorMessage(new ApiError(409, 'measured_locked', 'Đã khoá'), 'fb')).toBe('Đã khoá')
  })
  it('leaves 422 to the inline field errors when a known field is flagged', () => {
    expect(childErrorMessage(fieldsError({ height_cm: 'bad' }), 'fb')).toBeNull()
  })
  it('still shows a generic message for 422 with only unmapped fields', () => {
    expect(childErrorMessage(fieldsError({ unknown_field: 'bad' }), 'fb')).toBe('fb')
    expect(childErrorMessage(fieldsError({}), 'fb')).toBe('fb')
  })
  it('returns null without an error and the fallback for unrelated errors', () => {
    expect(childErrorMessage(null, 'fb')).toBeNull()
    expect(childErrorMessage(new ApiError(500, 'boom', 'x'), 'fb')).toBe('fb')
  })
})
