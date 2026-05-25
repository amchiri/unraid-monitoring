import { useCallback, useEffect, useRef, useState } from 'react'
import { useEcoMode } from './eco'

export interface PollState<T> {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => void
}

/** Appelle `fetcher` immédiatement puis toutes les `intervalMs`. */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): PollState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const { eco } = useEcoMode()

  const run = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    run()
    const actualInterval = eco ? intervalMs * 4 : intervalMs
    const id = setInterval(run, actualInterval)
    return () => clearInterval(id)
  }, [run, intervalMs, enabled, eco])

  return { data, error, loading, refresh: run }
}
