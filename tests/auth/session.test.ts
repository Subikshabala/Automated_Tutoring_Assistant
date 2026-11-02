import { beforeEach, describe, expect, it } from 'vitest'

const user = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  role: 'USER' as const,
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

describe('signSession', () => {
  it('produces a three-part JWT', async () => {
    const { signSession } = await import('@/lib/auth/session')
    const token = await signSession(user)
    expect(token.split('.')).toHaveLength(3)
  })

  it('does not embed the password hash', async () => {
    const { signSession } = await import('@/lib/auth/session')
    const token = await signSession(user)
    expect(token).not.toContain('passwordHash')
  })
})

describe('verifySession', () => {
  it('round-trips the user payload', async () => {
    const { signSession, verifySession } = await import('@/lib/auth/session')
    const token = await signSession(user)
    await expect(verifySession(token)).resolves.toEqual(user)
  })

  it('returns null for a tampered token', async () => {
    const { signSession, verifySession } = await import('@/lib/auth/session')
    const token = await signSession(user)
    await expect(verifySession(`${token}x`)).resolves.toBeNull()
  })

  it('returns null for garbage', async () => {
    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession('not-a-token')).resolves.toBeNull()
  })

  it('returns null for undefined', async () => {
    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession(undefined)).resolves.toBeNull()
  })

  it('returns null when the payload fails schema validation', async () => {
    const { SignJWT } = await import('jose')
    const secret = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    const token = await new SignJWT({ id: 'u1', role: 'WIZARD' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)

    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession(token)).resolves.toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const { SignJWT } = await import('jose')
    const wrong = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('a-completely-different-secret-value'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    const token = await new SignJWT({ ...user })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrong)

    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession(token)).resolves.toBeNull()
  })
})
