import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { AppShell } from '../components/AppShell'
import { HomesListContext } from '../context/home'
import { ToastProvider } from '../context/toast'
import { useResource } from '../hooks/useResource'
import { listHomes } from '../lib/api'

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: () => (
    <div className="empty">
      <h3>Page not found</h3>
      <p>The page you are looking for does not exist.</p>
    </div>
  ),
})

function Root() {
  const load = useCallback((signal: AbortSignal) => listHomes(signal), [])
  const { state, reload } = useResource(load)

  const value = useMemo(() => ({ homes: state, reloadHomes: reload }), [state, reload])

  return (
    <ToastProvider>
      <HomesListContext.Provider value={value}>
        <AppShell>
          <Outlet />
        </AppShell>
      </HomesListContext.Provider>
    </ToastProvider>
  )
}
