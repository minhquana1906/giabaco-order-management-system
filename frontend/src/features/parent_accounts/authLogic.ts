import type { RegisterBody } from './api'

export interface RegisterValues {
  full_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
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

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Vui lòng nhập email.'
  return EMAIL_PATTERN.test(email) ? undefined : 'Email chưa đúng định dạng.'
}

export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}
  const phone = values.phone.trim()
  const emailError = validateEmail(values.email)
  if (!values.full_name.trim()) errors.full_name = 'Vui lòng nhập họ và tên.'
  if (emailError) errors.email = emailError
  if (!phone) errors.phone = 'Vui lòng nhập số điện thoại.'
  else if (!isValidPhone(phone)) errors.phone = 'Số điện thoại chưa đúng định dạng.'
  if (values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`
  if (values.confirm_password !== values.password) errors.confirm_password = 'Mật khẩu xác nhận không khớp.'
  return errors
}

export type LoginErrors = Partial<Record<'identifier' | 'password', string>>

export function validateLogin(values: { identifier: string; password: string }): LoginErrors {
  const errors: LoginErrors = {}
  if (!values.identifier.trim()) errors.identifier = 'Nhập email hoặc số điện thoại.'
  if (!values.password) errors.password = 'Nhập mật khẩu.'
  return errors
}

export const validateForgot = validateEmail

export function tokenFromHash(hash: string): string | undefined {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || undefined
}

export interface PasswordCriteria {
  longEnough: boolean
  matches: boolean
}

export function passwordCriteria(password: string, confirm: string): PasswordCriteria {
  return { longEnough: password.length >= MIN_PASSWORD_LENGTH, matches: confirm !== '' && confirm === password }
}

export function toRegisterBody(values: RegisterValues): RegisterBody {
  return {
    full_name: values.full_name.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    password: values.password,
  }
}

export function safeParentRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const isParentPath = value === '/parent' || /^\/parent[/?#]/.test(value)
  return isParentPath && !value.startsWith('//') ? value : undefined
}

export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters.map((w) => w!.charAt(0).toLocaleUpperCase('vi')).join('')
}
