import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, buildFormData } from '../../api/client'
import { ApiError } from '../../api/types'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'

beforeEach(() => {
  localStorage.setItem('adminToken', 'test-token-123')
})

describe('apiFetch', () => {
  it('sends X-API-Token header', async () => {
    let receivedToken: string | null = null

    server.use(
      http.get('/api/test-token', ({ request }) => {
        receivedToken = request.headers.get('X-API-Token')
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiFetch('/api/test-token')
    expect(receivedToken).toBe('test-token-123')
  })

  it('returns parsed JSON on success', async () => {
    server.use(
      http.get('/api/ping', () => HttpResponse.json({ pong: true })),
    )
    const data = await apiFetch<{ pong: boolean }>('/api/ping')
    expect(data.pong).toBe(true)
  })

  it('throws ApiError on 4xx', async () => {
    server.use(
      http.get('/api/bad', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 }),
      ),
    )
    await expect(apiFetch('/api/bad')).rejects.toBeInstanceOf(ApiError)
  })

  it('includes status in ApiError', async () => {
    server.use(
      http.get('/api/unauth', () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 }),
      ),
    )
    let caught: ApiError | null = null
    try {
      await apiFetch('/api/unauth')
    } catch (e) {
      caught = e as ApiError
    }
    expect(caught?.status).toBe(401)
    expect(caught?.detail).toBe('Unauthorized')
  })

  it('sets Content-Type for JSON body', async () => {
    let contentType: string | null = null
    server.use(
      http.post('/api/json-body', ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return HttpResponse.json({ ok: true })
      }),
    )
    await apiFetch('/api/json-body', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) })
    expect(contentType).toContain('application/json')
  })

  it('does not set Content-Type for FormData', async () => {
    let contentType: string | null = null
    server.use(
      http.post('/api/form-body', ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return HttpResponse.json({ ok: true })
      }),
    )
    const fd = new FormData()
    fd.append('key', 'value')
    await apiFetch('/api/form-body', { method: 'POST', body: fd })
    // Browser sets multipart/form-data automatically, not us
    expect(contentType).not.toBe('application/json')
  })
})

describe('buildFormData', () => {
  it('includes string values', () => {
    const fd = buildFormData({ name: 'test', value: '123' })
    expect(fd.get('name')).toBe('test')
    expect(fd.get('value')).toBe('123')
  })

  it('converts number to string', () => {
    const fd = buildFormData({ count: 42 })
    expect(fd.get('count')).toBe('42')
  })

  it('omits null and undefined', () => {
    const fd = buildFormData({ a: null, b: undefined, c: 'keep' })
    expect(fd.get('a')).toBeNull()
    expect(fd.get('b')).toBeNull()
    expect(fd.get('c')).toBe('keep')
  })

  it('appends File objects directly', () => {
    const file = new File(['content'], 'test.txt')
    const fd = buildFormData({ upload: file })
    expect(fd.get('upload')).toBe(file)
  })
})
