import { ApiError, parseApiError, withQuery } from './http'

describe('parseApiError', () => {
  it('reads the contract error shape including field paths', async () => {
    const res = new Response(
      JSON.stringify({
        error: { code: 'validation_error', message: 'Dữ liệu không hợp lệ', fields: { 'trials.0.size_label': 'Bắt buộc' } },
      }),
      { status: 422 },
    )
    const err = await parseApiError(res)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'validation_error', fields: { 'trials.0.size_label': 'Bắt buộc' } })
  })

  it('falls back when the body is not JSON', async () => {
    const err = await parseApiError(new Response('<html>bad gateway</html>', { status: 502 }))
    expect(err).toMatchObject({ status: 502, code: 'http_error' })
    expect(err.fields).toBeUndefined()
  })
})

describe('withQuery', () => {
  it('drops empty values', () => {
    expect(withQuery('/students', { q: '', page: 2, product: undefined, size: 'none' })).toBe('/students?page=2&size=none')
  })
})
