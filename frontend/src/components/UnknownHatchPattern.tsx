import { UNKNOWN_PATTERN_ID } from '@/lib/sizes'

export function UnknownHatchPattern() {
  return (
    <defs>
      <pattern
        id={UNKNOWN_PATTERN_ID}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill="#eef0f4" />
        <rect width="2" height="6" fill="#a9b2c3" />
      </pattern>
    </defs>
  )
}
