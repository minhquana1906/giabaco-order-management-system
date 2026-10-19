import type { PublicProduct, PublicTrial } from './api'

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
