import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

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
      es.addEventListener('changed', () => {
        void queryClient.invalidateQueries({ queryKey: ['students'] })
        void queryClient.invalidateQueries({ queryKey: ['stats'] })
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
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
