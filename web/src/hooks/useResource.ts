import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api'

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'success'; data: T }

/**
 * Loads data when mounted (and whenever `load` changes). Pass a `load` wrapped in
 * useCallback. `reload()` fetches again while keeping the old data on screen.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' })
  const controllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(() => {
    controllerRef.current?.abort() // a newer request replaces an older one
    const controller = new AbortController()
    controllerRef.current = controller

    setState((previous) => (previous.status === 'success' ? previous : { status: 'loading' }))
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError('Something went wrong.', null),
        })
      },
    )
  }, [load])

  useEffect(() => {
    fetchData()
    return () => controllerRef.current?.abort()
  }, [fetchData])

  return { state, reload: fetchData }
}
