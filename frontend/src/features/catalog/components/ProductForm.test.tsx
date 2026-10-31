import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyForm } from '../productFormLogic'
import { ProductForm } from './ProductForm'

vi.mock('../hooks', () => ({
  useBaseProducts: () => ({ data: [] }),
  useColours: () => ({ data: [] }),
  useMeasurementTypes: () => ({ data: [] }),
  useCreateMeasurementType: () => ({ isPending: false }),
  useRenameMeasurementType: () => ({ isPending: false }),
}))

describe('ProductForm measurements', () => {
  it('focuses the new type name and places it before the instruction when choosing Other', async () => {
    const user = userEvent.setup()
    render(<ProductForm mode="create" initial={emptyForm()} submitLabel="Tạo sản phẩm" pending={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Thêm số đo' }))
    await user.selectOptions(screen.getByLabelText('Loại số đo'), '__other__')

    const name = screen.getByLabelText('Tên loại số đo mới')
    const instruction = screen.getByLabelText('Nội dung hướng dẫn đo')
    expect(name).toHaveFocus()
    expect(name.compareDocumentPosition(instruction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
