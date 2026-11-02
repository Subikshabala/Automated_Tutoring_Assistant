import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { sessionUserSchema, type SessionUser } from '@/lib/schemas/auth'

export const SESSION_COOKIE = 'adaptive_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

let _cachedKey: CryptoKey | null = null
let _cachedSecret: string | null = null

async function secretKey(): Promise<CryptoKey> {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }
  if (_cachedKey && _cachedSecret === secret) return _cachedKey
  const raw = new TextEncoder().encode(secret)
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  _cachedSecret = secret
  return _cachedKey
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(await secretKey())
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, await secretKey())
    const result = sessionUserSchema.safeParse(payload)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}
