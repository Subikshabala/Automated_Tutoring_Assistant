import { beforeEach, describe, expect, it, vi } from 'vitest'

const createUser = vi.fn()
const authenticate = vi.fn()
const signSession = vi.fn()
const setSessionCookie = vi.fn()
const clearSessionCookie = vi.fn()
const getSessionUser = vi.fn()

vi.mock('@/lib/repositories/user', () => ({ createUser, authenticate }))
vi.mock('@/lib/auth/session', () => ({
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
}))

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', role: 'USER' }

function post(body: unknown) {
  return new Request('http://t/api/auth', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  signSession.mockResolvedValue('signed.jwt.token')
})

describe('POST /api/auth/register', () => {
  it('creates an account and sets the session cookie', async () => {
    createUser.mockResolvedValue(user)
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(
      post({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct-horse-battery',
      }),
    )
    expect(res.status).toBe(201)
    expect(setSessionCookie).toHaveBeenCalledWith('signed.jwt.token')
  })

  it('rejects a short password with 400', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(
      post({ name: 'Ada', email: 'ada@example.com', password: 'short' }),
    )
    expect(res.status).toBe(400)
  })

  it('surfaces EMAIL_TAKEN as 409', async () => {
    const { ApiError } = await import('@/lib/api')
    createUser.mockRejectedValue(
      new ApiError('EMAIL_TAKEN', 'Already registered', 409),
    )
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(
      post({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct-horse-battery',
      }),
    )
    expect(res.status).toBe(409)
  })

  it('never returns a password in the response', async () => {
    createUser.mockResolvedValue(user)
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(
      post({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct-horse-battery',
      }),
    )
    const text = await res.text()
    expect(text).not.toContain('correct-horse-battery')
  })
})

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials', async () => {
    authenticate.mockResolvedValue(user)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(
      post({ email: 'ada@example.com', password: 'correct-horse-battery' }),
    )
    expect(res.status).toBe(200)
    expect(setSessionCookie).toHaveBeenCalled()
  })

  it('returns 401 for bad credentials', async () => {
    authenticate.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(
      post({ email: 'ada@example.com', password: 'wrong' }),
    )
    expect(res.status).toBe(401)
  })

  it('does not reveal whether the email exists', async () => {
    authenticate.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(
      post({ email: 'nobody@example.com', password: 'x' }),
    )
    const body = await res.json()
    expect(body.error.message.toLowerCase()).not.toContain('email')
    expect(body.error.message.toLowerCase()).not.toContain('exist')
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const { POST } = await import('@/app/api/auth/logout/route')
    const res = await POST()
    expect(res.status).toBe(200)
    expect(clearSessionCookie).toHaveBeenCalled()
  })
})

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    getSessionUser.mockResolvedValue(user)
    const { GET } = await import('@/app/api/auth/me/route')
    const res = await GET()
    const body = await res.json()
    expect(body.data.email).toBe('ada@example.com')
  })

  it('returns null data when signed out', async () => {
    getSessionUser.mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/me/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
  })
})
