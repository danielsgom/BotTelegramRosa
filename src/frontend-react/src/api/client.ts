import { ApiError } from './types'

/** Read the stored token directly (works outside React components). */
function getToken(): string {
  return localStorage.getItem('adminToken') ?? ''
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-API-Token': getToken(),
    ...(options.headers as Record<string, string>),
  }

  // Let the browser set Content-Type (with boundary) for FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, { ...options, headers })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const json = await res.json()
      detail = json.detail ?? json.message ?? detail
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

export function buildFormData(
  data: Record<string, string | number | boolean | File | null | undefined>,
): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) fd.append(key, value)
    else fd.append(key, String(value))
  }
  return fd
}
