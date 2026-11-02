import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const listSources = vi.fn()
const createSource = vi.fn()
const transitionSourceStatus = vi.fn()
const deleteSource = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireAdmin, requireUser: vi.fn() }))
vi.mock('@/lib/repositories/source', () => ({
  listSources,
  createSource,
  transitionSourceStatus,
  deleteSource,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/admin/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/sources/s1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/sources', () => {
  it('returns sources for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    listSources.mockResolvedValue([{ id: 's1', title: 'RFC 1234' }])
    const { GET } = await import('@/app/api/admin/sources/route')
    const req = new Request('http://localhost/api/admin/sources')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('returns 403 for a non-admin', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Admin access is required', 403),
    )
    const { GET } = await import('@/app/api/admin/sources/route')
    const req = new Request('http://localhost/api/admin/sources')
    const res = await GET(req as never)
    expect(res.status).toBe(403)
  })

  it('returns 401 when signed out', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Sign in to continue', 401),
    )
    const { GET } = await import('@/app/api/admin/sources/route')
    const req = new Request('http://localhost/api/admin/sources')
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { GET } = await import('@/app/api/admin/sources/route')
    const req = new Request('http://localhost/api/admin/sources')
    await GET(req as never)
    expect(listSources).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/sources', () => {
  it('creates a source for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    createSource.mockResolvedValue({ id: 's1', title: 'My source' })
    const { POST } = await import('@/app/api/admin/sources/route')
    const res = await POST(jsonRequest({ title: 'My source' }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 403 for a non-admin', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Admin access is required', 403),
    )
    const { POST } = await import('@/app/api/admin/sources/route')
    const res = await POST(jsonRequest({ title: 'x' }) as never)
    expect(res.status).toBe(403)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { POST } = await import('@/app/api/admin/sources/route')
    await POST(jsonRequest({ title: 'x' }) as never)
    expect(createSource).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/sources/[id]', () => {
  it('transitions status for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    transitionSourceStatus.mockResolvedValue({ id: 's1', status: 'INGESTED' })
    const { PATCH } = await import('@/app/api/admin/sources/[id]/route')
    const res = await PATCH(patchRequest({ status: 'INGESTED' }) as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 403 for a non-admin', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Admin access is required', 403),
    )
    const { PATCH } = await import('@/app/api/admin/sources/[id]/route')
    const res = await PATCH(patchRequest({ status: 'INGESTED' }) as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(403)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { PATCH } = await import('@/app/api/admin/sources/[id]/route')
    await PATCH(patchRequest({ status: 'INGESTED' }) as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(transitionSourceStatus).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/admin/sources/[id]', () => {
  it('deletes a source for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    deleteSource.mockResolvedValue(undefined)
    const { DELETE } = await import('@/app/api/admin/sources/[id]/route')
    const req = new Request('http://localhost/api/admin/sources/s1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 403 for a non-admin', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Admin access is required', 403),
    )
    const { DELETE } = await import('@/app/api/admin/sources/[id]/route')
    const req = new Request('http://localhost/api/admin/sources/s1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(403)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { DELETE } = await import('@/app/api/admin/sources/[id]/route')
    const req = new Request('http://localhost/api/admin/sources/s1', {
      method: 'DELETE',
    })
    await DELETE(req as never, {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(deleteSource).not.toHaveBeenCalled()
  })
})
