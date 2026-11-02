import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const listLearnerOverview = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireAdmin, requireUser: vi.fn() }))
vi.mock('@/lib/repositories/admin', () => ({ listLearnerOverview }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/learners', () => {
  it('returns learners for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    listLearnerOverview.mockResolvedValue([
      { id: 'u2', name: 'Learner', email: 'x@example.com' },
    ])
    const { GET } = await import('@/app/api/admin/learners/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('returns 403 for a non-admin', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Admin access is required', 403),
    )
    const { GET } = await import('@/app/api/admin/learners/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 401 when signed out', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Sign in to continue', 401),
    )
    const { GET } = await import('@/app/api/admin/learners/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { GET } = await import('@/app/api/admin/learners/route')
    await GET()
    expect(listLearnerOverview).not.toHaveBeenCalled()
  })
})
