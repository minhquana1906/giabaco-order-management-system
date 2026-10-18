import { describe, expect, it } from 'vitest'
import { gradeFromName, withGrade } from './className'

describe('gradeFromName', () => {
  it.each([
    ['3A1', 3],
    ['10A1', 10],
    ['13A1', null],
    ['A1', null],
    ['', null],
  ])('%s -> %s', (name, grade) => {
    expect(gradeFromName(name)).toBe(grade)
  })
})

describe('withGrade', () => {
  it.each([
    ['', '3', '3'],
    ['1A1', '3', '3A1'],
    ['3A1', '10', '10A1'],
    ['A1', '4', '4A1'],
    ['10A1', '3', '3A1'],
  ])('%j + grade %s -> %s', (name, grade, expected) => {
    expect(withGrade(name, grade)).toBe(expected)
  })
})
