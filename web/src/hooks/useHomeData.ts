import { useCallback } from 'react'
import { getBill, listBalances, listBills } from '../lib/api'
import { useResource } from './useResource'

export function useBills(homeId: string) {
  const load = useCallback((signal: AbortSignal) => listBills(homeId, signal), [homeId])
  return useResource(load)
}

export function useBalances(homeId: string) {
  const load = useCallback((signal: AbortSignal) => listBalances(homeId, signal), [homeId])
  return useResource(load)
}

export function useBill(billId: string) {
  const load = useCallback((signal: AbortSignal) => getBill(billId, signal), [billId])
  return useResource(load)
}
