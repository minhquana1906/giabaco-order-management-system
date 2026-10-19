import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudentDetail } from '../api'
import { NewStudent } from './NewStudent'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}))
vi.mock('./QrCard', () => ({ QrCard: () => null }))
vi.mock('./StudentForm', () => ({
  StudentForm: ({ onSaved }: { onSaved: (s: StudentDetail) => void }) => (
    <button onClick={() => onSaved(saved)}>submit</button>
  ),
}))

let saved: StudentDetail
const student = (linkedParents: StudentDetail['linked_parents']) =>
  ({
    id: 'st1',
    full_name: 'Nguyễn Văn An',
    school: { id: 's1', name: 'Trường A' },
    class: { id: 'c1', name: '2A1' },
    linked_parents: linkedParents,
    portal_url: 'http://x/p/t',
  }) as unknown as StudentDetail

beforeEach(() => localStorage.clear())

describe('NewStudent confirmation', () => {
  it('announces the merge when the student was adopted from a parent-declared record', async () => {
    saved = student([
      { parent_id: 'p1', full_name: 'Lan', email: null, phone: '0912345678', origin: 'DECLARED', linked_at: '2026-10-01' },
    ])
    render(<NewStudent />)
    await userEvent.click(screen.getByRole('button', { name: 'submit' }))

    expect(screen.getByText('Đã lưu Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đã ghép với hồ sơ phụ huynh tự khai')
  })

  it('shows no merge notice for a plain new student', async () => {
    saved = student([])
    render(<NewStudent />)
    await userEvent.click(screen.getByRole('button', { name: 'submit' }))

    expect(screen.getByText('Đã lưu Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
