export const UNKNOWN_SIZE_LABEL = 'Chưa xác định'
export const UNKNOWN_PATTERN_ID = 'size-unknown-hatch'
export const UNKNOWN_PATTERN_FILL = `url(#${UNKNOWN_PATTERN_ID})`
export const UNKNOWN_HATCH_CLASS = 'hatch-unknown'

const FIRST = [0xc5, 0xd0, 0xe6] as const
const LAST = [0x1b, 0x2b, 0x4b] as const
const INK = '#16203a'
const WHITE = '#ffffff'

function channel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function hex(n: number) {
  return n.toString(16).padStart(2, '0')
}

export function sizeColor(index: number, count: number): string {
  const t = count <= 1 ? 0 : Math.min(1, Math.max(0, index / (count - 1)))
  const [r, g, b] = FIRST.map((from, i) => channel(from, LAST[i]!, t)) as [number, number, number]
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function luminance(color: string) {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function readableOn(background: string): string {
  return contrast(background, INK) >= contrast(background, WHITE) ? INK : WHITE
}

export function sizeTextColor(index: number, count: number): string {
  return readableOn(sizeColor(index, count))
}
