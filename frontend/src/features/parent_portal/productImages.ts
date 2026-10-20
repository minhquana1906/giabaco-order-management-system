import type { ProductColour } from '@/lib/productColour'

const IMAGE_PRODUCTS = new Set(['blazer', 'gile'])

export const PRODUCT_IMAGE_ASPECT = 'aspect-[1600/1473]'

export const LENS_WIDTH = 0.6

export interface Lens {
  x: number
  y: number
  paneWidth: number
  height: number
}

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export function lensAt(clientX: number, clientY: number, rect: Rect, paneWidth: number): Lens {
  const height = (LENS_WIDTH * rect.width) / paneWidth
  const x = ((clientX - rect.left) / rect.width - LENS_WIDTH / 2) / (1 - LENS_WIDTH)
  const y = ((clientY - rect.top) / rect.height - height / 2) / (1 - height)
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), paneWidth, height }
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
