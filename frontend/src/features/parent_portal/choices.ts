import { DEFAULT_COLOUR } from '@/lib/productColour'
import type { ChoiceChanges, ChoiceInput, PublicChoice, PublicProduct, PublicTrial } from './api'

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

export type Picks = Record<string, ChoiceInput | null | undefined>

export function initialPicks(products: PublicProduct[], saved: Record<string, PublicChoice>): Picks {
  const hasSaved = Object.keys(saved).length > 0
  return Object.fromEntries(
    products.map((p) => {
      const choice = saved[p.code]
      if (choice) return [p.code, { size_label: choice.size_label, colour: choice.colour ?? DEFAULT_COLOUR }]
      return [p.code, hasSaved ? null : undefined]
    }),
  )
}

export function pickChanges(products: PublicProduct[], picks: Picks, saved: Record<string, PublicChoice>): ChoiceChanges {
  const changes: ChoiceChanges = {}
  for (const p of products) {
    const next = picks[p.code] ?? undefined
    const current = saved[p.code]
    if (next === undefined && current === undefined) continue
    if (next && current && next.size_label === current.size_label && next.colour === current.colour) continue
    changes[p.code] = next
  }
  return changes
}
