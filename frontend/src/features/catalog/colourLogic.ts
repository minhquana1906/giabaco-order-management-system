import type { ColourOption } from './api'

const FALLBACK_SWATCH = '#d4d4d8'

export function colourLookup(options: ColourOption[] | undefined) {
  const byCode = new Map((options ?? []).map((o) => [o.code, o]))
  return {
    label: (code: string) => byCode.get(code)?.label ?? code,
    swatch: (code: string) => byCode.get(code)?.hex ?? FALLBACK_SWATCH,
  }
}
