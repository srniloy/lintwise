import type { ApiError } from '@/types'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

// ── GET response cache (5-minute TTL) ─────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: unknown
  ts: number
}

const requestCache = new Map<string, CacheEntry>()

export function invalidateCache(pattern?: string) {
  if (!pattern) {
    requestCache.clear()
    return
  }
  for (const key of requestCache.keys()) {
    if (key.includes(pattern)) requestCache.delete(key)
  }
}

function getCacheKey(endpoint: string): string {
  const token = getAccessToken()
  return `${token ?? 'anon'}::${endpoint}`
}

// ── Auth token ────────────────────────────────────────────────────────────────
function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('lintwise-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string } }
    return parsed?.state?.accessToken ?? null
  } catch {
    return null
  }
}

// ── Core request ──────────────────────────────────────────────────────────────
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  useCache = false,
): Promise<T> {
  const token = getAccessToken()

  // Serve from cache for GET requests
  if (useCache) {
    const cacheKey = getCacheKey(endpoint)
    const cached = requestCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data as T
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers })

  if (!res.ok) {
    let errorBody: ApiError = { message: 'An error occurred', statusCode: res.status }
    try {
      errorBody = (await res.json()) as ApiError
    } catch {
      /* non-JSON error body */
    }

    if (res.status === 401) {
      localStorage.removeItem('lintwise-auth')
      window.location.href = '/login'
    } else if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      const wait = retryAfter ? ` Retry in ${retryAfter}s.` : ''
      toast.error(`Rate limit exceeded.${wait}`)
    } else if (res.status >= 500) {
      toast.error('Server error — please try again later.')
    }

    throw errorBody
  }

  if (res.status === 204) return undefined as T

  const json = (await res.json()) as { status: string; data: T } | T
  // Unwrap the backend's standard { status, data } envelope
  if (
    json !== null &&
    typeof json === 'object' &&
    'status' in json &&
    'data' in json
  ) {
    const data = (json as { status: string; data: T }).data
    if (useCache) {
      requestCache.set(getCacheKey(endpoint), { data, ts: Date.now() })
    }
    return data
  }

  if (useCache) {
    requestCache.set(getCacheKey(endpoint), { data: json, ts: Date.now() })
  }
  return json as T
}

// ── Download ──────────────────────────────────────────────────────────────────
async function download(endpoint: string): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('lintwise-auth')
      window.location.href = '/login'
    } else if (res.status === 429) {
      toast.error('Rate limit exceeded. Please wait before downloading again.')
    } else if (res.status >= 500) {
      toast.error('Server error — download failed.')
    }
    let message = `Download failed (${res.status})`
    try {
      const body = (await res.json()) as ApiError
      if (body.message) message = body.message
    } catch {
      /* non-JSON error body */
    }
    throw { message, statusCode: res.status } as ApiError
  }

  const disp = res.headers.get('content-disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disp)
  const filename = match?.[1] ?? 'export'
  const blob = await res.blob()
  return { blob, filename }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const api = {
  /** GET with optional 5-minute cache. Pass `{ cache: true }` to enable. */
  get: <T>(endpoint: string, options?: Omit<RequestInit, 'cache'> & { cache?: boolean }) => {
    const { cache = false, ...rest } = options ?? {}
    return request<T>(endpoint, { method: 'GET', ...rest }, cache)
  },

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),

  download,
}
