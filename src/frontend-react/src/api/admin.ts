import { apiFetch, buildFormData } from './client'
import type { AdminUser, ChatMessage, QuickMessage, MessageBlock, PredefinedAsset } from './types'

// ─── Admin Users ────────────────────────────────────────────────────────────

export const fetchAdminUsers = async (params?: { search?: string; unread?: boolean }): Promise<AdminUser[]> => {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.unread) qs.set('unread', 'true')
  const query = qs.toString() ? `?${qs}` : ''
  const r = await apiFetch<{ success: boolean; total: number; users: AdminUser[] }>(`/api/admin/users${query}`)
  return r.users
}

export const fetchChatHistory = async (userId: number): Promise<{ user: AdminUser; messages: ChatMessage[] }> => {
  const r = await apiFetch<{ success: boolean; user: AdminUser; messages: ChatMessage[] }>(
    `/api/admin/users/${userId}/chat/history`,
  )
  return { user: r.user, messages: r.messages }
}

export const sendAdminMessage = (
  userId: number,
  data: {
    message?: string
    strip_link_ids?: string
    asset_id?: number
    file?: File
  },
) => {
  const fd = new FormData()
  if (data.message) fd.append('message', data.message)
  if (data.strip_link_ids) fd.append('strip_link_ids', data.strip_link_ids)
  if (data.asset_id) fd.append('asset_id', String(data.asset_id))
  if (data.file) fd.append('file', data.file)
  return apiFetch(`/api/admin/users/${userId}/chat/message`, { method: 'POST', body: fd })
}

export const markChatRead = (userId: number) =>
  apiFetch(`/api/admin/users/${userId}/chat/mark-read`, { method: 'POST' })

// ─── Quick Messages ─────────────────────────────────────────────────────────

export const fetchQuickMessages = async (): Promise<QuickMessage[]> => {
  const r = await apiFetch<{ success: boolean; messages: QuickMessage[] }>('/api/admin/quick-messages')
  return r.messages
}

export const createQuickMessage = (data: { name: string; text_es: string; text_en?: string; text_pt?: string }) =>
  apiFetch('/api/admin/quick-messages', { method: 'POST', body: JSON.stringify(data) })

export const updateQuickMessage = (id: number, data: { name?: string; text_es?: string; text_en?: string; text_pt?: string }) =>
  apiFetch(`/api/admin/quick-messages/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteQuickMessage = (id: number) =>
  apiFetch(`/api/admin/quick-messages/${id}`, { method: 'DELETE' })

// ─── Message Blocks ─────────────────────────────────────────────────────────

export const fetchMessageBlocks = async (): Promise<MessageBlock[]> => {
  const r = await apiFetch<{ success: boolean; blocks: MessageBlock[] }>('/api/admin/message-blocks')
  return r.blocks
}

export const createMessageBlock = (data: {
  name: string
  description?: string
  category?: string
  steps: Array<{ step_order: number; text_es: string; text_en?: string; text_pt?: string }>
}) => apiFetch('/api/admin/message-blocks', { method: 'POST', body: JSON.stringify(data) })

export const updateMessageBlock = (id: number, data: {
  name?: string
  description?: string
  category?: string
  steps?: Array<{ step_order: number; text_es: string; text_en?: string; text_pt?: string }>
}) => apiFetch(`/api/admin/message-blocks/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteMessageBlock = (id: number) =>
  apiFetch(`/api/admin/message-blocks/${id}`, { method: 'DELETE' })

export const sendMessageBlock = (blockId: number, userId: number) =>
  apiFetch(`/api/admin/message-blocks/${blockId}/send/${userId}`, { method: 'POST' })

// ─── Predefined Assets ───────────────────────────────────────────────────────

export const fetchPredefinedAssets = async (type?: string): Promise<PredefinedAsset[]> => {
  const qs = type ? `?type=${type}` : ''
  const r = await apiFetch<{ success: boolean; assets: PredefinedAsset[] }>(`/api/admin/predefined-assets${qs}`)
  return r.assets
}

export const createPredefinedAsset = (data: {
  name: string
  asset_type: string
  category?: string
  description?: string
  link_url?: string
  file?: File
}) => {
  const fd = buildFormData(data as Record<string, string | number | boolean | File | null | undefined>)
  return apiFetch('/api/admin/predefined-assets', { method: 'POST', body: fd })
}

export const deletePredefinedAsset = (id: number) =>
  apiFetch(`/api/admin/predefined-assets/${id}`, { method: 'DELETE' })
