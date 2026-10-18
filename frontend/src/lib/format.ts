const TZ = 'Asia/Ho_Chi_Minh'

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatNumber(value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: maxFractionDigits }).format(value)
}

export function formatPercent(percent: number, digits = 1): string {
  const text = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(percent)
  return `${text}%`
}

export function formatRate(rate: number | null | undefined, digits = 0): string {
  return rate == null ? '—' : formatPercent(rate * 100, digits)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const m = DATE_ONLY.exec(value)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d).replaceAll('-', '/')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d).replace(',', '')
}

export function formatCm(value: number | null | undefined): string {
  return value == null ? '—' : `${formatNumber(value, 1)} cm`
}

export function formatKg(value: number | null | undefined): string {
  return value == null ? '—' : `${formatNumber(value, 1)} kg`
}
