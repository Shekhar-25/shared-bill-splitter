import { createContext, useContext } from 'react'
import type { Resource } from '../hooks/useResource'
import type { Home, HomeDetail } from '../lib/api'

/** The home currently being viewed (loaded once by the /homes/$homeId layout route). */
export type HomeContextValue = { home: HomeDetail; reloadHome: () => void }
export const HomeContext = createContext<HomeContextValue | null>(null)

export function useHome(): HomeContextValue {
  const value = useContext(HomeContext)
  if (!value) throw new Error('useHome must be used inside a home page')
  return value
}

/** The list of all homes, used by the sidebar home selector and the homes page. */
export type HomesListValue = { homes: Resource<Home[]>; reloadHomes: () => void }
export const HomesListContext = createContext<HomesListValue>({
  homes: { status: 'loading' },
  reloadHomes: () => undefined,
})
export const useHomesList = () => useContext(HomesListContext)
