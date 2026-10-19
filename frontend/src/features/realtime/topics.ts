const ALL_KEYS = [['students'], ['stats']] as const

const TOPIC_KEYS: Record<string, readonly (readonly string[])[]> = {
  students: [['students'], ['stats']],
  choices: [['students'], ['stats']],
}

export function topicsToQueryKeys(data: unknown): readonly (readonly string[])[] {
  let topics: unknown
  try {
    topics = (JSON.parse(String(data)) as { topics?: unknown }).topics
  } catch {
    return ALL_KEYS
  }
  if (!Array.isArray(topics) || topics.length === 0) return ALL_KEYS
  const keys = new Map<string, readonly string[]>()
  for (const topic of topics) {
    const mapped = typeof topic === 'string' ? TOPIC_KEYS[topic] : undefined
    if (!mapped) return ALL_KEYS
    for (const key of mapped) keys.set(key.join('/'), key)
  }
  return [...keys.values()]
}
