import { apiFetch, buildFormData } from './client'
import type { User } from './types'

export const fetchUsers = async (params?: { active?: boolean; vip?: boolean; status?: string }): Promise<User[]> => {
  const qs = new URLSearchParams()
  if (params?.active !== undefined) qs.set('active', String(params.active))
  if (params?.vip !== undefined) qs.set('vip', String(params.vip))
  if (params?.status) qs.set('status', params.status)
  const query = qs.toString() ? `?${qs}` : ''
  const r = await apiFetch<{ success: boolean; count: number; users: User[] }>(`/api/users${query}`)
  return r.users
}

export const fetchUser = async (id: number): Promise<User> => {
  const r = await apiFetch<{ success: boolean; user: User }>(`/api/users/${id}`)
  return r.user
}

export const createUser = (data: { telegram_id: number; first_name?: string; last_name?: string; username?: string; language?: string }) =>
  apiFetch('/api/users', { method: 'POST', body: buildFormData(data) })

export const updateUser = (id: number, data: { first_name?: string; last_name?: string; username?: string; language?: string; is_active?: boolean; is_vip?: boolean; clear_error?: boolean }) =>
  apiFetch(`/api/users/${id}`, { method: 'PUT', body: buildFormData(data) })

export const deleteUser = (id: number) =>
  apiFetch(`/api/users/${id}`, { method: 'DELETE' })

export const resumeSequence = (userId: number) =>
  apiFetch(`/api/users/${userId}/resume-sequence`, { method: 'POST' })

export const fetchUserMessages = async (userId: number) => {
  const r = await apiFetch<{ success: boolean; messages: import('./types').BatchMessage[] }>(
    `/api/users/${userId}/messages`,
  )
  return r.messages
}
