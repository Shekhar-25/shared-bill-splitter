import { type ReactNode, useEffect, useState } from 'react'
import type { Resource } from '../hooks/useResource'
import { ErrorState } from './ui'

const SLOW_AFTER_MS = 4000

/** Shows a skeleton while loading, a helpful error with retry on failure, else the content. */
export function ResourceView<T>({
  resource,
  onRetry,
  skeleton,
  children,
}: {
  resource: Resource<T>
  onRetry: () => void
  skeleton: ReactNode
  children: (data: T) => ReactNode
}) {
  if (resource.status === 'loading') return <SlowAware skeleton={skeleton} />
  if (resource.status === 'error') {
    const { error } = resource
    return (
      <ErrorState
        title={error.status === 404 ? 'Not found' : 'We could not load this'}
        message={error.message}
        offline={error.status === null}
        onRetry={error.status === 404 ? undefined : onRetry}
      />
    )
  }
  return <>{children(resource.data)}</>
}

function SlowAware({ skeleton }: { skeleton: ReactNode }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div aria-busy="true" aria-live="polite">
      {skeleton}
      {slow && <p className="slow-hint">This is taking longer than usual. Still trying…</p>}
    </div>
  )
}
