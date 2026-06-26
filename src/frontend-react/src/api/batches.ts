import { apiFetch, buildFormData } from './client'
import type { Batch, BatchMessage } from './types'

export const fetchBatches = async (): Promise<Batch[]> => {
  const r = await apiFetch<{ success: boolean; batches: Batch[] }>('/api/batches')
  return r.batches
}

export const fetchBatch = async (id: number): Promise<Batch> => {
  const r = await apiFetch<{ success: boolean; batch: Batch }>(`/api/batches/${id}`)
  return r.batch
}

export const fetchBatchMessages = async (batchId: number): Promise<BatchMessage[]> => {
  const r = await apiFetch<{ success: boolean; messages: BatchMessage[] }>(
    `/api/batches/${batchId}/messages`,
  )
  return r.messages
}

export const createBatch = (data: { name: string; description?: string; order?: number }) =>
  apiFetch('/api/batches', { method: 'POST', body: buildFormData(data) })

export const updateBatch = (id: number, data: { name?: string; description?: string; order?: number }) =>
  apiFetch(`/api/batches/${id}`, { method: 'PUT', body: buildFormData(data) })

export const deleteBatch = (id: number) =>
  apiFetch(`/api/batches/${id}`, { method: 'DELETE' })

export const activateBatch = (id: number) =>
  apiFetch(`/api/batches/${id}/activate`, { method: 'POST' })

export const fetchScheduleState = async () => {
  const r = await apiFetch<{ success: boolean; state: import('./types').ScheduleState | null }>(
    '/api/batches/schedule/state',
  )
  return r.state
}

export const addMessageToBatch = (
  batchId: number,
  data: {
    title: string
    text_es: string
    text_en?: string
    text_pt?: string
    sequence_order?: number
    strip_link_ids?: string
    image?: File
  },
) => {
  const fd = buildFormData(data as Record<string, string | number | boolean | File | null | undefined>)
  return apiFetch(`/api/batches/${batchId}/messages`, { method: 'POST', body: fd })
}

export const updateMessageInBatch = (
  batchId: number,
  messageId: number,
  data: Record<string, string | number | boolean | File | null | undefined>,
) => {
  const fd = buildFormData(data)
  return apiFetch(`/api/batches/${batchId}/messages/${messageId}`, { method: 'PUT', body: fd })
}

export const deleteMessageFromBatch = (batchId: number, messageId: number) =>
  apiFetch(`/api/batches/${batchId}/messages/${messageId}`, { method: 'DELETE' })
