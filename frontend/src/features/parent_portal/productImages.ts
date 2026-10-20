import type { ProductColour } from '@/lib/productColour'

const IMAGE_PRODUCTS = new Set(['blazer', 'gile'])

export const PRODUCT_IMAGE_ASPECT = 'aspect-[1600/1473]'

export interface ProductImageSources {
  src: string
  thumb: string
  srcSet: string
}

export function productImage(code: string, gender: 'MALE' | 'FEMALE', colour: ProductColour): ProductImageSources | null {
  if (!IMAGE_PRODUCTS.has(code)) return null
  const base = `/products/${code}_${gender === 'MALE' ? 'nam' : 'nu'}_${colour}`
  return { src: `${base}.webp`, thumb: `${base}_900.webp`, srcSet: `${base}_900.webp 900w, ${base}.webp 1600w` }
}
