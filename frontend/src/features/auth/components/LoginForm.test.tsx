import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LoginForm } from './LoginForm'

it('uses a document navigation for the parent login link', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm onSuccess={() => {}} />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('link', { name: 'Phụ huynh đăng nhập tại đây' }).getAttribute('href')).toBe('/parent/login')
})
