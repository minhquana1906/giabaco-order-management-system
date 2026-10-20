import type { ProductColour } from '@/lib/productColour'

const IMAGE_PRODUCTS = new Set(['blazer', 'gile'])

export function productImageSrc(code: string, gender: 'MALE' | 'FEMALE', colour: ProductColour): string | null {
  if (!IMAGE_PRODUCTS.has(code)) return null
  return `/products/${code}_${gender === 'MALE' ? 'nam' : 'nu'}_${colour}.jpg`
}
