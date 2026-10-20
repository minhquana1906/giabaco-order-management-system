import type { RefObject } from 'react'

export function focusFirstInvalid(formRef: RefObject<HTMLFormElement | null>) {
  requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
