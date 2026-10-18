export interface ApiErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string> }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const FALLBACK_MESSAGE = 'Có lỗi xảy ra, vui lòng thử lại.'

export async function parseApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  const err = body?.error
  return new ApiError(
    res.status,
    err?.code ?? 'http_error',
    err?.message ?? FALLBACK_MESSAGE,
    err?.fields,
  )
}

type Params = Record<string, string | number | boolean | null | undefined>

export function withQuery(path: string, params?: Params): string {
  if (!params) return path
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network_error', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  }
  if (!res.ok) throw await parseApiError(res)
  return res
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const http = {
  get: <T>(path: string, params?: Params, signal?: AbortSignal) =>
    json<T>(withQuery(path, params), { signal }),
  post: <T>(path: string, body?: unknown) =>
    json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    json<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    json<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T = void>(path: string) => json<T>(path, { method: 'DELETE' }),
}

function filenameFrom(disposition: string | null, fallback: string): string {
  const star = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (star) return decodeURIComponent(star)
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback
}

export async function downloadFile(path: string, params?: Params, fallbackName = 'download') {
  const res = await send(withQuery(path, params))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFrom(res.headers.get('Content-Disposition'), fallbackName)
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
