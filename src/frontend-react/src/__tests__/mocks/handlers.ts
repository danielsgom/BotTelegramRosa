import { http, HttpResponse } from 'msw'
import type { Batch, StripLink, User, AdminUser, LogEntry, VipConfig } from '../../api/types'
import type { ScheduleState } from '../../api/types'

export const mockBatch: Batch = {
  id: 1, name: 'Lote 1', description: 'Desc', order: 1,
  is_active: true, message_count: 2, created_at: '2024-01-01T00:00:00',
  messages: [],
}

export const mockLink: StripLink = {
  id: 1, name: 'Plan Básico', url: 'https://buy.stripe.com/test',
  language: 'es', duration_days: 30, stripe_link_id: 'sl_test',
  name_translations: { es: 'Plan Básico', en: 'Basic Plan' },
  created_at: '2024-01-01T00:00:00',
}

export const mockUser: User = {
  id: 1, telegram_id: 123456789, first_name: 'Ana', last_name: 'García',
  username: 'ana_garcia', language: 'es', is_active: true, is_vip: false,
  vip_expires_at: null, vip_days_remaining: 0, vip_message_sent_at: null,
  current_batch_id: 1, current_batch_name: 'Lote 1', current_message_step: 0,
  messages_sent_count: 5, joined_at: '2024-01-01T00:00:00', last_message_at: '2024-06-01T00:00:00',
}

export const mockScheduleState: ScheduleState = {
  current_batch: { id: 1, name: 'Lote 1', total_messages: 3 },
  current_message_index: 1,
  current_message: { id: 2, title: 'Msg 2' },
  last_sent_at: '2024-06-01T10:00:00',
  next_send_at: '2024-06-01T14:00:00',
  hours_interval: 4,
  active_users: 42,
}

export const mockLog: LogEntry = {
  ts: '2024-06-01T10:00:00', level: 'INFO', name: 'backend.routes.health', msg: 'Health OK',
}

export const mockVipConfig: VipConfig = {
  text_translations: { es: 'Únete al VIP', en: 'Join VIP', pt: 'Junte-se ao VIP' },
  button_text_translations: { es: 'Únete', en: 'Join', pt: 'Junte-se' },
  image_url: null, invite_url: 'https://t.me/+test',
}

export const handlers = [
  http.get('/api/batches', () =>
    HttpResponse.json({ success: true, batches: [mockBatch] }),
  ),
  http.get('/api/batches/schedule/state', () =>
    HttpResponse.json({ success: true, state: mockScheduleState }),
  ),
  http.get('/api/batches/:id/messages', () =>
    HttpResponse.json({ success: true, messages: [] }),
  ),
  http.post('/api/batches', () =>
    HttpResponse.json({ success: true, batch: { ...mockBatch, id: 2, name: 'Nuevo' } }, { status: 201 }),
  ),
  http.put('/api/batches/:id', () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete('/api/batches/:id', () =>
    HttpResponse.json({ success: true }),
  ),
  http.post('/api/batches/:id/activate', () =>
    HttpResponse.json({ success: true }),
  ),

  http.get('/api/stripe-links', () =>
    HttpResponse.json({ success: true, links: [mockLink] }),
  ),
  http.get('/api/admin/stripe-links', () =>
    HttpResponse.json({ success: true, links: [mockLink] }),
  ),
  http.post('/api/stripe-links', () =>
    HttpResponse.json({ success: true }, { status: 201 }),
  ),
  http.delete('/api/stripe-links/:id', () =>
    HttpResponse.json({ success: true }),
  ),

  http.get('/api/users', () =>
    HttpResponse.json({ success: true, count: 1, users: [mockUser] }),
  ),
  http.put('/api/users/:id', () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete('/api/users/:id', () =>
    HttpResponse.json({ success: true }),
  ),

  http.get('/api/scheduler/jobs', () =>
    HttpResponse.json({ success: true, jobs: [{ id: 'job1', name: 'send_messages', next_run_time: '2024-06-01T14:00:00', trigger: 'interval' }] }),
  ),

  http.get('/api/logs', () =>
    HttpResponse.json({ success: true, count: 1, logs: [mockLog] }),
  ),

  http.get('/api/vip-config', () =>
    HttpResponse.json({ success: true, config: mockVipConfig }),
  ),
  http.post('/api/vip-config', () =>
    HttpResponse.json({ success: true }),
  ),

  http.get('/api/admin/users', () =>
    HttpResponse.json({ success: true, total: 1, users: [] }),
  ),
  http.get('/api/admin/users/:id/chat/history', () =>
    HttpResponse.json({ success: true, user: null, messages: [] }),
  ),
  http.post('/api/admin/users/:id/chat/mark-read', () =>
    HttpResponse.json({ success: true }),
  ),
  http.post('/api/admin/users/:id/chat/message', () =>
    HttpResponse.json({ success: true }),
  ),

  http.get('/api/admin/quick-messages', () =>
    HttpResponse.json({ success: true, messages: [] }),
  ),
  http.get('/api/admin/message-blocks', () =>
    HttpResponse.json({ success: true, blocks: [] }),
  ),
  http.get('/api/admin/predefined-assets', () =>
    HttpResponse.json({ success: true, assets: [] }),
  ),
]
