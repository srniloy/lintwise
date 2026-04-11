import type { ApiError } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

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

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken()

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
    }

    throw errorBody
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'GET', ...options }),

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
}
