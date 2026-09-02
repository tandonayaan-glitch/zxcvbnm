import { useCallback, useEffect, useRef, useState } from 'react'
import { firebaseErrorMessage } from '@/lib/firebaseError'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  refetch: () => void
}

// eslint-disable-next-line react-hooks/exhaustive-deps -- deps are explicit
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fn()
      .then((res) => {
        if (active && mounted.current) setData(res)
      })
      .catch((e) => {
        if (active && mounted.current)
          setError(firebaseErrorMessage(e, 'Failed to load. Please try again.'))
      })
      .finally(() => {
        if (active && mounted.current) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, refetch }
}
