import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/fetcher'

function mockFetch(body: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetch', () => {
  it('unwraps the data envelope', async () => {
    mockFetch({ data: { id: '1' } })
    await expect(apiFetch('/api/courses')).resolves.toEqual({ id: '1' })
  })

  it('throws the server message on an error envelope', async () => {
    mockFetch({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404)
    await expect(apiFetch('/api/courses/x')).rejects.toThrow('Course not found')
  })

  it('throws a generic message when the body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('<html>', { status: 500 }))
    await expect(apiFetch('/api/courses')).rejects.toThrow('Request failed')
  })

  it('sends a JSON content-type when given a body', async () => {
    mockFetch({ data: { ok: true } })
    await apiFetch('/api/courses', { method: 'POST', json: { title: 'X' } })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"title":"X"}')
  })
})
