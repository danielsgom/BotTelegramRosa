import { apiFetch } from './client'

export interface SchedulerJob {
  id: string
  name: string
  next_run_time: string | null
  trigger: string
}

export const fetchSchedulerJobs = async (): Promise<SchedulerJob[]> => {
  const r = await apiFetch<{ success: boolean; jobs: SchedulerJob[] }>('/api/scheduler/jobs')
  return r.jobs
}
