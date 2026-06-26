import { apiFetch, buildFormData } from './client'
import type { StripLink } from './types'

export const fetchStripeLinks = async (): Promise<StripLink[]> => {
  const r = await apiFetch<{ success: boolean; links: StripLink[] }>('/api/stripe-links')
  return r.links
}

export const createStripeLink = (data: {
  name: string
  url: string
  language?: string
  duration_days?: number
  stripe_link_id?: string
  name_es?: string
  name_en?: string
  name_pt?: string
}) => apiFetch('/api/stripe-links', { method: 'POST', body: buildFormData(data) })

export const updateStripeLink = (id: number, data: {
  name: string
  url: string
  language?: string
  duration_days?: number
  stripe_link_id?: string
  name_es?: string
  name_en?: string
  name_pt?: string
}) => apiFetch(`/api/stripe-links/${id}`, { method: 'PUT', body: buildFormData(data) })

export const deleteStripeLink = (id: number) =>
  apiFetch(`/api/stripe-links/${id}`, { method: 'DELETE' })

// Admin read-only variant (same data, different endpoint)
export const fetchAdminStripeLinks = async (): Promise<StripLink[]> => {
  const r = await apiFetch<{ success: boolean; links: StripLink[] }>('/api/admin/stripe-links')
  return r.links
}
