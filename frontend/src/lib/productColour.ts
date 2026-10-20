export type ProductColour = 'navy' | 'ghi'

export const DEFAULT_COLOUR: ProductColour = 'navy'

export const PRODUCT_COLOURS: { value: ProductColour; label: string }[] = [
  { value: 'navy', label: 'Navy' },
  { value: 'ghi', label: 'Ghi' },
]

export function colourLabel(colour: ProductColour | null | undefined): string | null {
  return PRODUCT_COLOURS.find((c) => c.value === colour)?.label ?? null
}
