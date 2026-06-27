import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBatches,
  fetchBatch,
  fetchBatchMessages,
  createBatch,
  updateBatch,
  deleteBatch,
  activateBatch,
  fetchScheduleState,
  addMessageToBatch,
  updateMessageInBatch,
  deleteMessageFromBatch,
  sendNextBatchMessage,
} from '../api/batches'

const KEY = 'batches'

export const useBatches = () =>
  useQuery({ queryKey: [KEY], queryFn: fetchBatches })

export const useBatch = (id: number) =>
  useQuery({ queryKey: [KEY, id], queryFn: () => fetchBatch(id), enabled: id > 0 })

export const useBatchMessages = (batchId: number) =>
  useQuery({
    queryKey: [KEY, batchId, 'messages'],
    queryFn: () => fetchBatchMessages(batchId),
    enabled: batchId > 0,
  })

export const useScheduleState = () =>
  useQuery({ queryKey: ['schedule-state'], queryFn: fetchScheduleState, refetchInterval: 10_000 })

export const useCreateBatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBatch,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useUpdateBatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateBatch>[1] }) =>
      updateBatch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useDeleteBatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useActivateBatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['schedule-state'] })
    },
  })
}

export const useSendNextBatchMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendNextBatchMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-state'] })
    },
  })
}

export const useAddMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ batchId, data }: { batchId: number; data: Parameters<typeof addMessageToBatch>[1] }) =>
      addMessageToBatch(batchId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: [KEY, vars.batchId, 'messages'] }),
  })
}

export const useUpdateMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      batchId,
      messageId,
      data,
    }: {
      batchId: number
      messageId: number
      data: Record<string, string | number | boolean | File | null | undefined>
    }) => updateMessageInBatch(batchId, messageId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: [KEY, vars.batchId, 'messages'] }),
  })
}

export const useDeleteMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ batchId, messageId }: { batchId: number; messageId: number }) =>
      deleteMessageFromBatch(batchId, messageId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: [KEY, vars.batchId, 'messages'] }),
  })
}
