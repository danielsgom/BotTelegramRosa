import { useQuery } from '@tanstack/react-query'
import { fetchLogs } from '../api/logs'

export const useLogs = (params?: { level?: string; limit?: number }) =>
  useQuery({
    queryKey: ['logs', params],
    queryFn: () => fetchLogs(params),
    refetchInterval: 5_000,
  })
