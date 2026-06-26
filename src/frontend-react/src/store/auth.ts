/** Simple auth store — reads/writes raw string to localStorage (compatible with legacy frontend). */

const KEY = 'adminToken'

export const authStore = {
  getToken: () => localStorage.getItem(KEY) ?? '',
  setToken: (token: string) => localStorage.setItem(KEY, token),
}

// React hook (subscribes to storage events so multiple tabs stay in sync)
import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

export function useApiToken() {
  const token = useSyncExternalStore(subscribe, authStore.getToken)
  return { token, setToken: authStore.setToken }
}
