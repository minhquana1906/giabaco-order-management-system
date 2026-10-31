export interface ApiErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string>; request_id?: string }
}

export interface ApiErrorMeta {
  /** Short reference printed in the server log for this request. */
  requestId?: string
  /** Seconds to wait before retrying, from the `Retry-After` header of a 429. */
  retryAfterS?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>
  readonly requestId?: string
  readonly retryAfterS?: number

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    meta?: ApiErrorMeta,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.requestId = meta?.requestId
    this.retryAfterS = meta?.retryAfterS
  }
}

export const GENERIC_ERROR_MESSAGE = 'Chưa thực hiện được thao tác. Vui lòng thử lại sau ít phút.'
export const MAINTENANCE_MESSAGE = 'Máy chủ đang khởi động lại hoặc bảo trì. Vui lòng thử lại sau ít phút.'
export const TOO_LARGE_MESSAGE = 'Dữ liệu gửi lên quá lớn (tối đa 8 MB). Chọn tệp nhỏ hơn rồi thử lại.'

/** Messages for responses that do not carry our JSON envelope (proxy or middleware replies). */
function fallbackMessage(status: number): string {
  if (status === 413) return TOO_LARGE_MESSAGE
  if (status === 502 || status === 503 || status === 504) return MAINTENANCE_MESSAGE
  return GENERIC_ERROR_MESSAGE
}

export async function parseApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  const err = body?.error
  const retryAfter = Number(res.headers.get('Retry-After'))
  return new ApiError(
    res.status,
    err?.code ?? 'http_error',
    err?.message ?? fallbackMessage(res.status),
    err?.fields,
    {
      requestId: err?.request_id ?? res.headers.get('X-Request-ID') ?? undefined,
      retryAfterS: retryAfter > 0 ? retryAfter : undefined,
    },
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
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
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
  postForm: <T>(path: string, body: FormData) => json<T>(path, { method: 'POST', body }),
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
