import type { Product } from '@/features/catalog/api'
import type { StudentDetail } from '../api'

export function formProducts(profile: Product[], all: Product[], recordedCodes: string[]): Product[] {
  const inProfile = new Set(profile.map((p) => p.code))
  const recorded = new Set(recordedCodes)
  return [...profile, ...all.filter((p) => recorded.has(p.code) && !inProfile.has(p.code))]
}

export function pickByCodes<T>(record: Record<string, T>, codes: string[]): Record<string, T> {
  const allowed = new Set(codes)
  return Object.fromEntries(Object.entries(record).filter(([code]) => allowed.has(code)))
}

export function detailProducts(
  profile: { code: string; name: string }[],
  trials: StudentDetail['trials'],
): { code: string; name: string }[] {
  const seen = new Set(profile.map((p) => p.code))
  const extra: { code: string; name: string }[] = []
  for (const t of trials) {
    if (seen.has(t.product_code)) continue
    seen.add(t.product_code)
    extra.push({ code: t.product_code, name: t.product_name })
  }
  return [...profile, ...extra]
}
