import type { ProductColour } from '@/lib/productColour'

const IMAGE_PRODUCTS = new Set(['blazer', 'gile'])

export const PRODUCT_IMAGE_ASPECT = 'aspect-[1600/1473]'

export const ZOOM_FACTOR = 2.5
export const PANE_WIDTH_RATIO = 1.25
export const LENS_WIDTH = PANE_WIDTH_RATIO / ZOOM_FACTOR
export const LENS_HEIGHT = 1 / ZOOM_FACTOR

export interface LensTravel {
  x: number
  y: number
}

export function lensTravel(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): LensTravel {
  const x = ((clientX - rect.left) / rect.width - LENS_WIDTH / 2) / (1 - LENS_WIDTH)
  const y = ((clientY - rect.top) / rect.height - LENS_HEIGHT / 2) / (1 - LENS_HEIGHT)
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
}

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
