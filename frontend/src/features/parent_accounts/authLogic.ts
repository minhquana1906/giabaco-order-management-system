import type { RegisterBody } from './api'

export interface RegisterValues {
  full_name: string
  email: string
  phone: string
  password: string
}

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>

export const MIN_PASSWORD_LENGTH = 8

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidPhone(raw: string): boolean {
  let cleaned = raw.replace(/[\s.\-()]/g, '')
  if (cleaned.startsWith('+84')) cleaned = `0${cleaned.slice(3)}`
  else if (cleaned.startsWith('84') && cleaned.length === 11) cleaned = `0${cleaned.slice(2)}`
  return /^0\d{9}$/.test(cleaned)
}

export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}
  const email = values.email.trim()
  const phone = values.phone.trim()
  if (!values.full_name.trim()) errors.full_name = 'Vui lòng nhập họ và tên.'
  if (!email && !phone) errors.email = 'Nhập email hoặc số điện thoại để đăng nhập lần sau.'
  else {
    if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Email chưa đúng định dạng.'
    if (phone && !isValidPhone(phone)) errors.phone = 'Số điện thoại chưa đúng định dạng.'
  }
  if (values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`
  return errors
}

export function toRegisterBody(values: RegisterValues): RegisterBody {
  const email = values.email.trim()
  const phone = values.phone.trim()
  return {
    full_name: values.full_name.trim(),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    password: values.password,
  }
}

export function safeParentRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const isParentPath = value === '/parent' || /^\/parent[/?#]/.test(value)
  return isParentPath && !value.startsWith('//') ? value : undefined
}
