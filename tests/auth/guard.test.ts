import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUser = vi.fn()
vi.mock('@/lib/auth/session', () => ({ getSessionUser }))

const learner = { id: 'u1', email: 'a@b.c', name: 'A', role: 'USER' as const }
const admin = { id: 'u2', email: 'x@y.z', name: 'X', role: 'ADMIN' as const }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireUser', () => {
  it('returns the session user when signed in', async () => {
    getSessionUser.mockResolvedValue(learner)
    const { requireUser } = await import('@/lib/auth/guard')
    await expect(requireUser()).resolves.toEqual(learner)
  })

  it('throws UNAUTHORIZED when signed out', async () => {
    getSessionUser.mockResolvedValue(null)
    const { requireUser } = await import('@/lib/auth/guard')
    await expect(requireUser()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    })
  })
})

describe('requireAdmin', () => {
  it('returns the user when they are an admin', async () => {
    getSessionUser.mockResolvedValue(admin)
    const { requireAdmin } = await import('@/lib/auth/guard')
    await expect(requireAdmin()).resolves.toEqual(admin)
  })

  it('throws FORBIDDEN for a signed-in non-admin', async () => {
    getSessionUser.mockResolvedValue(learner)
    const { requireAdmin } = await import('@/lib/auth/guard')
    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    })
  })

  it('throws UNAUTHORIZED when signed out', async () => {
    getSessionUser.mockResolvedValue(null)
    const { requireAdmin } = await import('@/lib/auth/guard')
    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    })
  })
})
