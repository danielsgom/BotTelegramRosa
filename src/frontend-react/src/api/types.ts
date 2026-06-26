// ─── Core domain types matching backend response contracts ────────────────────

export interface StripLinkRef {
  id: number
  name: string
  url: string
  name_translations?: Record<string, string>
}

export interface BatchMessage {
  id: number
  batch_id: number
  title: string
  text: string
  text_translations: Record<string, string>
  image_url: string | null
  strip_links: StripLinkRef[]
  sequence_order: number
  created_at: string
}

export interface Batch {
  id: number
  name: string
  description: string | null
  order: number
  is_active: boolean
  message_count: number
  created_at: string
  messages: BatchMessage[]
}

export interface StripLink {
  id: number
  name: string
  url: string
  language: string | null
  duration_days: number
  stripe_link_id: string
  name_translations: Record<string, string>
  created_at: string
}

export interface User {
  id: number
  telegram_id: number
  first_name: string
  last_name: string
  username: string
  language: string
  is_active: boolean
  is_vip: boolean
  vip_expires_at: string | null
  vip_days_remaining: number
  vip_message_sent_at: string | null
  current_batch_id: number | null
  current_batch_name: string | null
  current_message_step: number
  messages_sent_count: number
  joined_at: string
  last_message_at: string
  send_error: string | null
  send_error_at: string | null
}

export interface UserDetail {
  id: number
  telegram_id: number
  first_name: string | null
  last_name: string | null
  username: string | null
  language: string
  is_active: boolean
  is_vip: boolean
  vip_expires_at: string | null
  joined_at: string
  last_message_at: string
  payments_count: number
}

export interface ScheduleState {
  current_batch: { id: number; name: string; total_messages: number } | null
  current_message_index: number
  current_message: { id: number; title: string } | null
  last_sent_at: string | null
  next_send_at: string | null
  hours_interval: number
  active_users: number
}

export interface LogEntry {
  ts: string
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  name: string
  msg: string
}

export interface VipConfig {
  text_translations: Record<string, string>
  button_text_translations: Record<string, string>
  image_url: string | null
  invite_url: string
}

export interface AdminUser {
  id: number
  telegram_id: number
  first_name: string | null
  last_name: string | null
  username: string | null
  language: string | null
  is_active: boolean
  is_vip: boolean
  unread_count: number
  last_message_preview: string | null
  joined_at: string
  last_message_at: string
}

export interface ChatMessage {
  id: number
  content: string | null
  type: string
  sent_by: 'user' | 'admin'
  attachment_url: string | null
  status: string
  is_read: boolean
  created_at: string
  delivered_at: string | null
}

export interface QuickMessage {
  id: number
  name: string
  text_es: string
  text_en: string
  text_pt: string
  created_at: string
}

export interface MessageBlockStep {
  id: number
  step_order: number
  text_es: string
  text_en: string
  text_pt: string
}

export interface MessageBlock {
  id: number
  name: string
  description: string | null
  category: string | null
  created_at: string
  steps: MessageBlockStep[]
}

export interface PredefinedAsset {
  id: number
  name: string
  asset_type: 'audio' | 'image' | 'video' | 'link'
  file_url: string | null
  link_url: string | null
  category: string | null
  description: string | null
  created_at: string
}

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
    this.name = 'ApiError'
  }
}
