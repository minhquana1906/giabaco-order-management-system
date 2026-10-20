export interface DobParts {
  day: string
  month: string
  year: string
}

export const EMPTY_DOB: DobParts = { day: '', month: '', year: '' }

export function dobFromIso(iso: string): DobParts {
  const [year = '', month = '', day = ''] = iso.split('-')
  if (!year || !month || !day) return EMPTY_DOB
  return { day: String(Number(day)), month: String(Number(month)), year }
}

export function dobToIso({ day, month, year }: DobParts): string | null {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!d || !m || !y) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  if (date.getTime() > Date.now()) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
