import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { ResourceView } from '../components/ResourceView'
import { Skeleton } from '../components/ui'
import { HomeContext } from '../context/home'
import { useResource } from '../hooks/useResource'
import { getHome, type HomeDetail } from '../lib/api'

export const Route = createFileRoute('/homes/$homeId')({
  component: HomeLayout,
})

/** Loads the home (with its members) once and shares it with every page below. */
function HomeLayout() {
  const { homeId } = Route.useParams()
  const load = useCallback((signal: AbortSignal) => getHome(homeId, signal), [homeId])
  const { state, reload } = useResource(load)

  return (
    <ResourceView
      resource={state}
      onRetry={reload}
      skeleton={
        <div className="stack">
          <Skeleton width="40%" height={36} />
          <Skeleton height={120} />
        </div>
      }
    >
      {(home) => <HomeProvider home={home} reloadHome={reload} />}
    </ResourceView>
  )
}

function HomeProvider({ home, reloadHome }: { home: HomeDetail; reloadHome: () => void }) {
  const value = useMemo(() => ({ home, reloadHome }), [home, reloadHome])
  return (
    <HomeContext.Provider value={value}>
      <Outlet />
    </HomeContext.Provider>
  )
}
