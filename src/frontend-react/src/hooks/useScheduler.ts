import { useQuery } from '@tanstack/react-query'
import { fetchSchedulerJobs } from '../api/scheduler'

export const useSchedulerJobs = () =>
  useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn: fetchSchedulerJobs,
    refetchInterval: 15_000,
  })
