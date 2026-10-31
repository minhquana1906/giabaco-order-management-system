import { describe, expect, it } from 'vitest'
import { emptyForm, emptySizeRow, moveRow, toBody, validateForm, type ProductForm } from './productFormLogic'

const valid = (): ProductForm => ({ ...emptyForm(), code: 'quan_sooc', name: 'Quần sooc', colours: ['ghi'] })

function withRow(patch: Partial<ProductForm['sizes'][number]>): ProductForm {
  const form = valid()
  form.sizes = [{ ...emptySizeRow('1'), ...patch }]
  return form
}

describe('validateForm', () => {
  it('accepts a blank size guide', () => {
    expect(validateForm(valid(), 'create')).toEqual({})
  })

  it('requires lowercase code only when creating', () => {
    const form = { ...valid(), code: 'Quần Sooc' }
    expect(validateForm(form, 'create').code).toBeDefined()
    expect(validateForm(form, 'edit').code).toBeUndefined()
  })

  it('requires a colour and a unique size name', () => {
    const form = { ...valid(), colours: [], sizes: [emptySizeRow('1'), emptySizeRow('1')] }
    const errors = validateForm(form, 'create')
    expect(errors.colours).toBeDefined()
    expect(errors['size-1']).toBe('Tên cỡ này đã dùng ở dòng khác. Đổi tên để tiếp tục.')
  })

  it.each([
    [{ heightMin: '120' }, 'Nhập chiều cao và cân nặng tối thiểu của cỡ này.'],
    [{ heightMin: '120', weightMin: '20', heightMax: '120' }, 'Chiều cao tối đa phải lớn hơn tối thiểu'],
    [{ heightMin: '120', weightMin: '20', weightMax: '19' }, 'Cân nặng tối đa phải lớn hơn tối thiểu'],
    [{ heightMin: '120', weightMin: '20', weightMax: '301' }, 'Số đo phải là số từ 0 đến 300.'],
    [{ heightMin: 'abc', weightMin: '20' }, 'Số đo phải là số từ 0 đến 300.'],
  ])('rejects guide row %j', (patch, message) => {
    expect(validateForm(withRow(patch), 'create')['size-0']).toBe(message)
  })

  it('accepts an open upper bound', () => {
    expect(validateForm(withRow({ heightMin: '165', weightMin: '45,5' }), 'create')).toEqual({})
  })

  it('validates measurement keys and labels', () => {
    const form = valid()
    form.tailorMeasurements = [
      { key: 'vong_nguc', label: 'Vòng ngực', instruction: '', required: true },
      { key: 'vong_nguc', label: 'Ngực', instruction: '', required: false },
    ]
    expect(validateForm(form, 'edit')['measurement-1']).toBe('Loại số đo này đã chọn ở dòng khác. Chọn loại khác để tiếp tục.')
    form.tailorMeasurements[1] = { key: 'eo', label: ' ', instruction: '', required: false }
    expect(validateForm(form, 'edit')['measurement-1']).toBe('Nhập tên cho số đo này.')
    form.tailorMeasurements[1] = { key: '', label: '', instruction: '', required: false }
    expect(validateForm(form, 'edit')['measurement-1']).toBe('Chọn loại số đo cho dòng này.')
    expect(toBody(form).tailor_measurements[0]?.key).toBe('vong_nguc')
  })
})

describe('toBody', () => {
  it('keeps only filled guide rows and null upper bounds', () => {
    const form = valid()
    form.sizes = [emptySizeRow('1'), { ...emptySizeRow('2'), heightMin: '165', weightMin: '45,5' }]
    expect(toBody(form)).toMatchObject({
      sizes: ['1', '2'],
      size_guide: [{ size_label: '2', height_min_cm: 165, height_max_cm: null, weight_min_kg: 45.5, weight_max_kg: null }],
    })
  })

  it('sends null guide when every row is blank', () => {
    expect(toBody(valid()).size_guide).toBeNull()
  })
})

describe('moveRow', () => {
  it('reorders and ignores out-of-range moves', () => {
    expect(moveRow(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveRow(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
