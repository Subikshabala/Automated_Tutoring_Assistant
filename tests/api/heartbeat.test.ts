import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const startSession = vi.fn()
const recordConceptView = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/repositories/learning', () => ({ startSession, recordConceptView }))

function post(body: unknown) {
  return new Request('http://t/api/learning/heartbeat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
  startSession.mockResolvedValue({ id: 's1' })
  recordConceptView.mockResolvedValue(undefined)
})

describe('POST /api/learning/heartbeat', () => {
  it('records a concept view', async () => {
    const { POST } = await import('@/app/api/learning/heartbeat/route')
    const res = await POST(post({ topicId: 't1', conceptId: 'c1', seconds: 30 }))
    expect(res.status).toBe(200)
    expect(startSession).toHaveBeenCalledWith('u1', 't1')
    expect(recordConceptView).toHaveBeenCalledWith('u1', 'c1', 30)
  })

  it('skips recording at 0 seconds but still starts the session', async () => {
    const { POST } = await import('@/app/api/learning/heartbeat/route')
    const res = await POST(post({ topicId: 't1', conceptId: 'c1', seconds: 0 }))
    expect(res.status).toBe(200)
    expect(startSession).toHaveBeenCalledWith('u1', 't1')
    expect(recordConceptView).not.toHaveBeenCalled()
  })

  it('rejects seconds > 300', async () => {
    const { POST } = await import('@/app/api/learning/heartbeat/route')
    const res = await POST(post({ topicId: 't1', conceptId: 'c1', seconds: 500 }))
    expect(res.status).toBe(400)
  })

  it('rejects a missing conceptId', async () => {
    const { POST } = await import('@/app/api/learning/heartbeat/route')
    const res = await POST(post({ topicId: 't1', seconds: 10 }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { ApiError } = await import('@/lib/api')
    requireUser.mockRejectedValue(new ApiError('UNAUTHORIZED', 'Sign in', 401))
    const { POST } = await import('@/app/api/learning/heartbeat/route')
    const res = await POST(post({ topicId: 't1', conceptId: 'c1', seconds: 10 }))
    expect(res.status).toBe(401)
  })
})
