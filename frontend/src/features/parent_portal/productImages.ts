export type ProductColour = 'navy' | 'ghi'

export const PRODUCT_COLOURS: { value: ProductColour; label: string }[] = [
  { value: 'navy', label: 'Navy' },
  { value: 'ghi', label: 'Ghi' },
]

const IMAGE_PRODUCTS = new Set(['blazer', 'gile'])

export function productImageSrc(code: string, gender: 'MALE' | 'FEMALE', colour: ProductColour): string | null {
  if (!IMAGE_PRODUCTS.has(code)) return null
  return `/products/${code}_${gender === 'MALE' ? 'nam' : 'nu'}_${colour}.jpg`
}
