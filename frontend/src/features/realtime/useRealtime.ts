import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { topicsToQueryKeys } from './topics'

const MIN_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

export function useRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = MIN_DELAY_MS
    let dropped = false
    let stopped = false

    const connect = () => {
      const es = new EventSource('/api/events', { withCredentials: true })
      source = es
      es.addEventListener('changed', (event) => {
        for (const queryKey of topicsToQueryKeys((event as MessageEvent).data)) {
          void queryClient.invalidateQueries({ queryKey: [...queryKey] })
        }
      })
      es.onopen = () => {
        delay = MIN_DELAY_MS
        if (!dropped) return
        dropped = false
        void queryClient.invalidateQueries()
      }
      es.onerror = () => {
        dropped = true
        if (es.readyState !== EventSource.CLOSED || stopped) return
        es.close()
        timer = setTimeout(connect, delay)
        delay = Math.min(delay * 2, MAX_DELAY_MS)
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      source?.close()
    }
  }, [queryClient])
}
