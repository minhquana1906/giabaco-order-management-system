export type Fit = 'TOO_TIGHT' | 'FITS' | 'TOO_LOOSE'

export const FIT_VALUES: readonly Fit[] = ['TOO_TIGHT', 'FITS', 'TOO_LOOSE']

export const FIT_LABEL: Record<Fit, string> = {
  TOO_TIGHT: 'Chật',
  FITS: 'Vừa',
  TOO_LOOSE: 'Rộng',
}
