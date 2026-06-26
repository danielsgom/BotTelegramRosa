import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminUsers,
  fetchChatHistory,
  sendAdminMessage,
  markChatRead,
  fetchQuickMessages,
  createQuickMessage,
  updateQuickMessage,
  deleteQuickMessage,
  fetchMessageBlocks,
  createMessageBlock,
  updateMessageBlock,
  deleteMessageBlock,
  sendMessageBlock,
  fetchPredefinedAssets,
  createPredefinedAsset,
  deletePredefinedAsset,
} from '../api/admin'

// ─── Admin users ─────────────────────────────────────────────────────────────

export const useAdminUsers = (params?: { search?: string; unread?: boolean }) =>
  useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => fetchAdminUsers(params),
    refetchInterval: 8_000,
  })

export const useChatHistory = (userId: number) =>
  useQuery({
    queryKey: ['chat-history', userId],
    queryFn: () => fetchChatHistory(userId),
    enabled: userId > 0,
    refetchInterval: 4_000,
  })

export const useSendMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Parameters<typeof sendAdminMessage>[1] }) =>
      sendAdminMessage(userId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-history', vars.userId] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export const useMarkRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markChatRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

// ─── Quick messages ──────────────────────────────────────────────────────────

export const useQuickMessages = () =>
  useQuery({ queryKey: ['quick-messages'], queryFn: fetchQuickMessages })

export const useCreateQuickMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createQuickMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-messages'] }),
  })
}

export const useUpdateQuickMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateQuickMessage>[1] }) =>
      updateQuickMessage(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-messages'] }),
  })
}

export const useDeleteQuickMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteQuickMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-messages'] }),
  })
}

// ─── Message blocks ──────────────────────────────────────────────────────────

export const useMessageBlocks = () =>
  useQuery({ queryKey: ['message-blocks'], queryFn: fetchMessageBlocks })

export const useCreateMessageBlock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMessageBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-blocks'] }),
  })
}

export const useUpdateMessageBlock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateMessageBlock>[1] }) =>
      updateMessageBlock(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-blocks'] }),
  })
}

export const useDeleteMessageBlock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMessageBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-blocks'] }),
  })
}

export const useSendMessageBlock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, userId }: { blockId: number; userId: number }) =>
      sendMessageBlock(blockId, userId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['chat-history', vars.userId] }),
  })
}

// ─── Predefined assets ───────────────────────────────────────────────────────

export const usePredefinedAssets = (type?: string) =>
  useQuery({ queryKey: ['predefined-assets', type], queryFn: () => fetchPredefinedAssets(type) })

export const useCreateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPredefinedAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predefined-assets'] }),
  })
}

export const useDeleteAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePredefinedAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predefined-assets'] }),
  })
}
