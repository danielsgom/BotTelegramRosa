import { apiFetch } from './client'
import type { LogEntry } from './types'

export const fetchLogs = async (params?: { level?: string; limit?: number }): Promise<LogEntry[]> => {
  const qs = new URLSearchParams()
  if (params?.level) qs.set('level', params.level)
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs}` : ''
  const r = await apiFetch<{ success: boolean; count: number; logs: LogEntry[] }>(`/api/logs${query}`)
  return r.logs
}
