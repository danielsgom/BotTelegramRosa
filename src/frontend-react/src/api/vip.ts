import { apiFetch } from './client'
import type { VipConfig } from './types'

export const fetchVipConfig = async (): Promise<VipConfig> => {
  const r = await apiFetch<{ success: boolean; config: VipConfig }>('/api/vip-config')
  return r.config
}

export const saveVipConfig = (data: {
  text_es: string
  text_en?: string
  text_pt?: string
  button_text_es?: string
  button_text_en?: string
  button_text_pt?: string
  invite_url?: string
  image?: File | null
}) => {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) fd.append(key, value)
    else fd.append(key, String(value))
  }
  return apiFetch('/api/vip-config', { method: 'POST', body: fd })
}
