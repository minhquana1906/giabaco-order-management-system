import { afterEach, describe, expect, it } from 'vitest'
import {
  emptySurvey,
  loadDraft,
  measurementWarnings,
  saveDraft,
  toSurveyBody,
  validateSurvey,
  type SurveyValues,
} from './logic'

const TODAY = '2026-10-22'

const filled = (overrides: Partial<SurveyValues> = {}): SurveyValues => ({
  ...emptySurvey(TODAY),
  school_name: ' Tiểu học  Lê Quý Đôn ',
  province: 'Thành phố Hà Nội',
  ward: 'Phường Ba Đình',
  class_name: '2A1',
  child_full_name: '  Trần  Bảo Ngọc ',
  dob: { day: '4', month: '3', year: '2018' },
  gender: 'FEMALE',
  parent_phone: '0912 345 678',
  measure_method: 'TAPE_TODAY',
  height: '128,5',
  weight: '26',
  supply_option: 'STANDARD',
  ...overrides,
})

describe('validateSurvey', () => {
  it('accepts a complete form with the optional girths left empty', () => {
    expect(validateSurvey(filled(), TODAY)).toEqual({})
  })

  it('tells parents who type metres to use centimetres', () => {
    expect(validateSurvey(filled({ height: '1.35' }), TODAY).height).toMatch(/cm/)
  })

  it('rejects out-of-range optional girths but not empty ones', () => {
    expect(validateSurvey(filled({ chest: '300' }), TODAY).chest).toBeDefined()
    expect(validateSurvey(filled({ chest: '' }), TODAY).chest).toBeUndefined()
  })

  it('bounds the measurement date to the last 180 days', () => {
    expect(validateSurvey(filled({ measured_on: '2026-10-23' }), TODAY).measured_on).toBeDefined()
    expect(validateSurvey(filled({ measured_on: '2026-04-25' }), TODAY).measured_on).toBeUndefined()
    expect(validateSurvey(filled({ measured_on: '2026-04-24' }), TODAY).measured_on).toBeDefined()
  })

  it('requires the school block and a supply option', () => {
    const errors = validateSurvey(
      filled({ school_name: ' ', province: '', ward: '', class_name: '', supply_option: '' }),
      TODAY,
    )
    expect(Object.keys(errors).sort()).toEqual([
      'class_name',
      'province',
      'school_name',
      'supply_option',
      'ward',
    ])
  })
})

describe('measurementWarnings', () => {
  it('flags implausible combinations without blocking', () => {
    expect(measurementWarnings(filled())).toEqual([])
    expect(measurementWarnings(filled({ weight: '80' }))).toHaveLength(1)
    expect(measurementWarnings(filled({ chest: '60', waist: '80' }))).toHaveLength(1)
  })
})

describe('toSurveyBody', () => {
  it('normalizes the name, parses decimals and nulls empty girths', () => {
    const body = toSurveyBody(filled({ waist: '55' }))
    expect(body).toMatchObject({
      school_name: 'Tiểu học Lê Quý Đôn',
      ward: 'Phường Ba Đình',
      child_full_name: 'Trần Bảo Ngọc',
      dob: '2018-03-04',
      height_cm: 128.5,
      chest_cm: null,
      waist_cm: 55,
      fit_preference: null,
    })
  })
})

describe('draft', () => {
  afterEach(() => localStorage.clear())

  it('restores a saved draft over the empty form and survives a corrupt one', () => {
    saveDraft(filled({ child_full_name: 'Nháp' }))
    expect(loadDraft(TODAY)).toMatchObject({ child_full_name: 'Nháp', ward: 'Phường Ba Đình' })
    localStorage.setItem('guniform-survey-draft', '{oops')
    expect(loadDraft(TODAY)).toEqual(emptySurvey(TODAY))
    saveDraft(null)
    expect(loadDraft(TODAY)).toEqual(emptySurvey(TODAY))
  })
})
