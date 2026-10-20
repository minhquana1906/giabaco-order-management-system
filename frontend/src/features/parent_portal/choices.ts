import type { ProductColour } from '@/lib/productColour'
import type { ChoiceChanges, PublicChoice, PublicProduct, PublicStudent, PublicTrial } from './api'

export function derivedSize(product: PublicProduct, trials: PublicTrial[]): string | null {
  let best = -1
  for (const t of trials) {
    if (t.product_code === product.code && t.fit === 'FITS') {
      best = Math.max(best, product.sizes.indexOf(t.size_label))
    }
  }
  return best >= 0 ? product.sizes[best]! : null
}

export type PortalStep = 'identity' | 'measure' | 'overview'

export function initialStep(hasChoices: boolean, skipIdentity: boolean): PortalStep {
  if (hasChoices) return 'overview'
  return skipIdentity ? 'measure' : 'identity'
}

export interface Suggestion {
  size: string
  source: 'trial' | 'chart'
}

export function suggestionFor(
  product: PublicProduct,
  student: Pick<PublicStudent, 'trials' | 'data_source' | 'suggested_sizes'>,
): Suggestion | null {
  const measured = derivedSize(product, student.trials)
  if (measured) return { size: measured, source: 'trial' }
  const chart = student.data_source === 'PARENT_DECLARED' ? student.suggested_sizes[product.code] : null
  return chart && product.sizes.includes(chart) ? { size: chart, source: 'chart' } : null
}

export interface PickedSize {
  size_label: string
  colour: ProductColour | null
}

export type Picks = Record<string, PickedSize | null | undefined>

export function initialPicks(
  products: PublicProduct[],
  saved: Record<string, PublicChoice>,
  suggested: Record<string, Suggestion | null> = {},
): Picks {
  const hasSaved = Object.keys(saved).length > 0
  return Object.fromEntries(
    products.map((p) => {
      const choice = saved[p.code]
      if (choice) return [p.code, { size_label: choice.size_label, colour: choice.colour }]
      if (hasSaved) return [p.code, null]
      const suggestion = suggested[p.code]
      return [p.code, suggestion ? { size_label: suggestion.size, colour: null } : undefined]
    }),
  )
}

export function pickChanges(products: PublicProduct[], picks: Picks, saved: Record<string, PublicChoice>): ChoiceChanges {
  const changes: ChoiceChanges = {}
  for (const p of products) {
    const next = picks[p.code] ?? undefined
    const current = saved[p.code]
    if (next && !next.colour) continue
    if (next === undefined && current === undefined) continue
    if (next && current && next.size_label === current.size_label && next.colour === current.colour) continue
    changes[p.code] = next?.colour ? { size_label: next.size_label, colour: next.colour } : undefined
  }
  return changes
}

export function missingColours(products: PublicProduct[], picks: Picks): string[] {
  return products
    .filter((p) => {
      const pick = picks[p.code]
      return pick != null && !pick.colour
    })
    .map((p) => p.code)
}

export function canContinue(products: PublicProduct[], picks: Picks, saved: Record<string, PublicChoice>): boolean {
  if (products.some((p) => picks[p.code] === undefined)) return false
  return missingColours(products, picks).length > 0 || Object.keys(pickChanges(products, picks, saved)).length > 0
}
