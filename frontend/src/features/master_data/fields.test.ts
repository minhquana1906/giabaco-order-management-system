import { expect, it } from 'vitest'
import { fold, requiredFor, SECTIONS, type Definition } from './fields'

const definition: Definition = {
  fields: ['Nhóm NPL', 'Thành phần', 'Trạng thái phê duyệt', 'NCC'],
  required: ['Nhóm NPL'],
  conditional_required: [
    { field: 'Thành phần', when: 'Nhóm NPL', starts_with: 'Vải' },
    { field: 'NCC', when: 'Trạng thái phê duyệt', equals: 'Đã phê duyệt' },
  ],
}

it('adds conditionally required fields from the draft', () => {
  expect([...requiredFor(definition, {})]).toEqual(['Nhóm NPL'])
  expect(requiredFor(definition, { 'Nhóm NPL': 'Vải dệt kim' }).has('Thành phần')).toBe(true)
  expect(requiredFor(definition, { 'Trạng thái phê duyệt': 'Đã phê duyệt' }).has('NCC')).toBe(true)
})

it('folds case and Vietnamese diacritics for search', () => {
  expect(fold('Đồng phục ÁO')).toBe('dong phuc ao')
})

it('places every field in at most one form section', () => {
  for (const sections of Object.values(SECTIONS)) {
    const all = sections.flatMap((section) => section.fields)
    expect(new Set(all).size).toBe(all.length)
  }
})
