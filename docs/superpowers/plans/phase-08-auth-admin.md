# Phase 8 — Auth & Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Real accounts replace the demo user. A visitor can register, sign in, and see only their own progress, materials and maps. An admin can manage courses and sources behind a role check.

**Architecture:** Email/password with bcrypt hashing and a signed JWT in an httpOnly cookie, verified with `jose` so it works in the Edge runtime. Next.js 16 renames middleware to **Proxy** — the file is `proxy.ts` and the export is `proxy`. The proxy does optimistic redirects only; every Route Handler independently resolves the session, because a cookie check at the edge is not authorisation.

**Tech Stack:** bcryptjs · jose · Next.js 16 Proxy · Prisma · Zod · shadcn/ui

**Depends on:** Phases 4–7 complete (they all currently read through `ensureDemoUser`).

**Done when:** registration and login work, every learner-scoped route reads the real session, `/admin` is reachable only by an ADMIN, and `ensureDemoUser` is gone from the codebase.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/schemas/auth.ts` | Register, login, session contracts |
| `lib/auth/password.ts` | bcrypt hash and verify |
| `lib/auth/session.ts` | JWT sign, verify, cookie read/write |
| `lib/auth/guard.ts` | `requireUser`, `requireAdmin` for handlers |
| `lib/repositories/user.ts` | User creation and lookup |
| `proxy.ts` | Optimistic route protection |
| `app/api/auth/register/route.ts` | `POST` create account |
| `app/api/auth/login/route.ts` | `POST` sign in |
| `app/api/auth/logout/route.ts` | `POST` sign out |
| `app/api/auth/me/route.ts` | `GET` current session |
| `app/api/admin/courses/route.ts` | Admin course CRUD |
| `components/auth-form.tsx` | Shared register/login form |
| `components/user-menu.tsx` | Avatar + sign out |
| `app/login/page.tsx` · `app/register/page.tsx` | Auth pages |
| `app/admin/page.tsx` | Admin dashboard |
| `app/profile/page.tsx` | Account page |

---

## Task 1: Auth schemas

**Files:**
- Create: `lib/schemas/auth.ts`
- Test: `tests/lib/schemas-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, sessionUserSchema } from '@/lib/schemas/auth'

describe('registerSchema', () => {
  const valid = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'correct-horse-battery',
  }

  it('accepts a well formed registration', () => {
    expect(registerSchema.parse(valid).email).toBe('ada@example.com')
  })

  it('lowercases the email', () => {
    expect(registerSchema.parse({ ...valid, email: 'Ada@Example.COM' }).email).toBe(
      'ada@example.com',
    )
  })

  it('trims the name', () => {
    expect(registerSchema.parse({ ...valid, name: '  Ada  ' }).name).toBe('Ada')
  })

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(
      false,
    )
  })

  it('rejects a password under 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(
      false,
    )
  })

  it('rejects a password over 72 bytes', () => {
    // bcrypt silently truncates past 72 bytes, so reject rather than mislead.
    expect(
      registerSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success,
    ).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts an email and password', () => {
    const parsed = loginSchema.parse({
      email: 'ada@example.com',
      password: 'anything',
    })
    expect(parsed.email).toBe('ada@example.com')
  })

  it('lowercases the email', () => {
    expect(
      loginSchema.parse({ email: 'ADA@EXAMPLE.COM', password: 'x' }).email,
    ).toBe('ada@example.com')
  })

  it('rejects an empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'ada@example.com', password: '' }).success,
    ).toBe(false)
  })
})

describe('sessionUserSchema', () => {
  it('accepts a session payload', () => {
    const parsed = sessionUserSchema.parse({
      id: 'u1',
      email: 'ada@example.com',
      name: 'Ada',
      role: 'USER',
    })
    expect(parsed.role).toBe('USER')
  })

  it('accepts the ADMIN role', () => {
    expect(
      sessionUserSchema.parse({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        role: 'ADMIN',
      }).role,
    ).toBe('ADMIN')
  })

  it('rejects an unknown role', () => {
    expect(
      sessionUserSchema.safeParse({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        role: 'SUPERUSER',
      }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/auth'`.

- [ ] **Step 3: Create `lib/schemas/auth.ts`**

```ts
import { z } from 'zod'

export const roleSchema = z.enum(['USER', 'ADMIN'])

const emailSchema = z
  .string()
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase())

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema,
})

export type Role = z.infer<typeof roleSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-auth.test.ts`
Expected: PASS — `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/auth.ts tests/lib/schemas-auth.test.ts
git commit -m "feat(auth): add zod contracts for register, login and session"
```

---

## Task 2: Password hashing

**Files:**
- Create: `lib/auth/password.ts`
- Test: `tests/auth/password.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('hashPassword', () => {
  it('does not return the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery')
    expect(hash).not.toBe('correct-horse-battery')
  })

  it('produces a bcrypt hash', async () => {
    const hash = await hashPassword('correct-horse-battery')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('produces a different hash each time thanks to the salt', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })
})

describe('verifyPassword', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it('rejects a password that differs only in case', async () => {
    const hash = await hashPassword('CaseSensitive')
    await expect(verifyPassword('casesensitive', hash)).resolves.toBe(false)
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/auth/password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/password'`.

- [ ] **Step 3: Create `lib/auth/password.ts`**

```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS)
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, hash)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/auth/password.test.ts`
Expected: PASS — `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts tests/auth/password.test.ts
git commit -m "feat(auth): add bcrypt password hashing"
```

---

## Task 3: Session tokens

`jose` rather than `jsonwebtoken` because the proxy runs in the Edge runtime, where Node crypto is unavailable.

**Files:**
- Create: `lib/auth/session.ts`
- Test: `tests/auth/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/session.test.ts`:

```ts
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
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const token = await new SignJWT({ id: 'u1', role: 'WIZARD' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)

    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession(token)).resolves.toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const { SignJWT } = await import('jose')
    const wrong = new TextEncoder().encode('a-completely-different-secret-value')
    const token = await new SignJWT({ ...user })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrong)

    const { verifySession } = await import('@/lib/auth/session')
    await expect(verifySession(token)).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/auth/session.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/session'`.

- [ ] **Step 3: Create `lib/auth/session.ts`**

```ts
import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { sessionUserSchema, type SessionUser } from '@/lib/schemas/auth'

export const SESSION_COOKIE = 'adaptive_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey())
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
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
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/auth/session.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts tests/auth/session.test.ts
git commit -m "feat(auth): add jose session signing and httpOnly cookie handling"
```

---

## Task 4: Route guards

**Files:**
- Create: `lib/auth/guard.ts`
- Test: `tests/auth/guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/guard.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/auth/guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/auth/guard.ts`**

```ts
import { ApiError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/schemas/auth'

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new ApiError('UNAUTHORIZED', 'Sign in to continue', 401)
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN', 'Admin access is required', 403)
  }
  return user
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/auth/guard.test.ts`
Expected: PASS — `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/guard.ts tests/auth/guard.test.ts
git commit -m "feat(auth): add requireUser and requireAdmin guards"
```

---

## Task 5: User repository

**Files:**
- Create: `lib/repositories/user.ts`
- Test: `tests/repositories/user.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/user.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  authenticate,
  createUser,
  findUserByEmail,
} from '@/lib/repositories/user'

const input = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: input.email } })
})

describe('createUser', () => {
  it('creates a user with the USER role', async () => {
    const user = await createUser(input)
    expect(user.role).toBe('USER')
    expect(user.email).toBe('ada@example.com')
  })

  it('does not return the password hash', async () => {
    const user = await createUser(input)
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('stores a hashed password, not the plaintext', async () => {
    await createUser(input)
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: input.email },
    })
    expect(row.passwordHash).not.toBe(input.password)
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/)
  })

  it('throws EMAIL_TAKEN on a duplicate email', async () => {
    await createUser(input)
    await expect(createUser(input)).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      status: 409,
    })
  })
})

describe('findUserByEmail', () => {
  it('returns the user when present', async () => {
    await createUser(input)
    const user = await findUserByEmail('ada@example.com')
    expect(user!.name).toBe('Ada Lovelace')
  })

  it('returns null when absent', async () => {
    await expect(findUserByEmail('nobody@example.com')).resolves.toBeNull()
  })
})

describe('authenticate', () => {
  it('returns the user for correct credentials', async () => {
    await createUser(input)
    const user = await authenticate(input.email, input.password)
    expect(user!.email).toBe('ada@example.com')
  })

  it('returns null for a wrong password', async () => {
    await createUser(input)
    await expect(authenticate(input.email, 'wrong')).resolves.toBeNull()
  })

  it('returns null for an unknown email', async () => {
    await expect(authenticate('nobody@example.com', 'x')).resolves.toBeNull()
  })

  it('never returns the password hash', async () => {
    await createUser(input)
    const user = await authenticate(input.email, input.password)
    expect(user).not.toHaveProperty('passwordHash')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/user.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/user.ts`**

```ts
import prisma from '@/lib/prisma'
import { ApiError } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import type { RegisterInput, SessionUser } from '@/lib/schemas/auth'

export async function createUser(
  input: RegisterInput,
): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (existing) {
    throw new ApiError(
      'EMAIL_TAKEN',
      'An account with that email already exists',
      409,
    )
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true, name: true, role: true },
  })

  return user
}

export async function findUserByEmail(
  email: string,
): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  })
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const row = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })
  if (!row) return null

  const valid = await verifyPassword(password, row.passwordHash)
  if (!valid) return null

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/user.test.ts`
Expected: PASS — `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/user.ts tests/repositories/user.test.ts
git commit -m "feat(auth): add user repository with create and authenticate"
```

---

## Task 6: Auth endpoints

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`
- Test: `tests/api/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/auth/register/route.ts`**

```ts
import { handle, ok, parseJson } from '@/lib/api'
import { registerSchema } from '@/lib/schemas/auth'
import { createUser } from '@/lib/repositories/user'
import { setSessionCookie, signSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, registerSchema)
    const user = await createUser(input)
    await setSessionCookie(await signSession(user))
    return ok(user, 201)
  })
}
```

- [ ] **Step 4: Create `app/api/auth/login/route.ts`**

The error message is deliberately identical for an unknown email and a wrong password.

```ts
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { loginSchema } from '@/lib/schemas/auth'
import { authenticate } from '@/lib/repositories/user'
import { setSessionCookie, signSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  return handle(async () => {
    const { email, password } = await parseJson(request, loginSchema)
    const user = await authenticate(email, password)

    if (!user) {
      throw new ApiError(
        'INVALID_CREDENTIALS',
        'Those details do not match an account',
        401,
      )
    }

    await setSessionCookie(await signSession(user))
    return ok(user)
  })
}
```

- [ ] **Step 5: Create `app/api/auth/logout/route.ts`**

```ts
import { handle, ok } from '@/lib/api'
import { clearSessionCookie } from '@/lib/auth/session'

export async function POST() {
  return handle(async () => {
    await clearSessionCookie()
    return ok({ signedOut: true })
  })
}
```

- [ ] **Step 6: Create `app/api/auth/me/route.ts`**

```ts
import { handle, ok } from '@/lib/api'
import { getSessionUser } from '@/lib/auth/session'

export async function GET() {
  return handle(async () => {
    return ok(await getSessionUser())
  })
}
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npm test tests/api/auth.test.ts`
Expected: PASS — `10 passed`.

- [ ] **Step 8: Commit**

```bash
git add app/api/auth tests/api/auth.test.ts
git commit -m "feat(api): add register, login, logout and me endpoints"
```

---

## Task 7: Proxy route protection

Next.js 16 renamed middleware to **Proxy**. The file is `proxy.ts` and the export is `proxy` — `middleware.ts` will be ignored.

**Files:**
- Create: `proxy.ts`

- [ ] **Step 1: Create `proxy.ts` at the project root**

This is optimistic protection only. It checks the cookie signature to avoid a pointless render, but every Route Handler still calls `requireUser` independently.

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

const PROTECTED_PREFIXES = [
  '/progress',
  '/materials',
  '/profile',
  '/admin',
  '/assessment',
]

const AUTH_PAGES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySession(token)

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )

  if (isProtected && !session) {
    const url = new URL('/login', request.nextUrl)
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/progress', request.nextUrl))
  }

  if (AUTH_PAGES.includes(path) && session) {
    return NextResponse.redirect(new URL('/progress', request.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)',
  ],
}
```

- [ ] **Step 2: Verify the proxy is picked up**

Run: `npm run dev`
Expected: the startup output does not warn about a missing or misnamed middleware file. Visiting `/progress` while signed out redirects to `/login?next=%2Fprogress`.

If nothing happens, confirm the filename is exactly `proxy.ts` at the project root (sibling of `app/`) and the export is named `proxy`.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(auth): add next.js 16 proxy for optimistic route protection"
```

---

## Task 8: Auth pages

**Files:**
- Create: `components/auth-form.tsx`
- Create: `app/login/page.tsx`
- Create: `app/register/page.tsx`
- Test: `tests/components/auth-form.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/auth-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/components/auth-form'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(''),
}))

afterEach(() => {
  vi.restoreAllMocks()
  push.mockReset()
})

describe('AuthForm in login mode', () => {
  it('renders email and password fields only', () => {
    render(<AuthForm mode="login" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('renders a Sign in button', () => {
    render(<AuthForm mode="login" />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('posts to the login endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<AuthForm mode="login" />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/auth/login')
  })

  it('shows the server error message', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Those details do not match an account',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    render(<AuthForm mode="login" />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Those details do not match an account'),
    ).toBeInTheDocument()
  })
})

describe('AuthForm in register mode', () => {
  it('renders a name field as well', () => {
    render(<AuthForm mode="register" />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('renders a Create account button', () => {
    render(<AuthForm mode="register" />)
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument()
  })

  it('posts to the register endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'u1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<AuthForm mode="register" />)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/auth/register')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/auth-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/auth-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { apiFetch } from '@/lib/fetcher'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await apiFetch(`/api/auth/${mode}`, {
        method: 'POST',
        json: isRegister ? { name, email, password } : { email, password },
      })
      router.push(searchParams.get('next') ?? '/progress')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        {isRegister && (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
          {isRegister && (
            <FieldDescription>At least 8 characters.</FieldDescription>
          )}
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner data-icon />}
        {isRegister ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create `app/login/page.tsx`**

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthForm } from '@/components/auth-form'

export const metadata = { title: 'Sign in — Adaptive' }

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Pick up where you left off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <AuthForm mode="login" />
          </Suspense>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/register/page.tsx`**

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthForm } from '@/components/auth-form'

export const metadata = { title: 'Create account — Adaptive' }

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-sm pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Your progress and materials stay tied to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <AuthForm mode="register" />
          </Suspense>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/components/auth-form.test.tsx`
Expected: PASS — `7 passed`.

- [ ] **Step 7: Commit**

```bash
git add components/auth-form.tsx app/login app/register tests/components/auth-form.test.tsx
git commit -m "feat(auth): add login and register pages"
```

---

## Task 9: Replace the demo user everywhere

This is the migration that makes auth real. Until it is done, every learner shares one account.

**Files:**
- Modify: `lib/repositories/assessment.ts`
- Modify: `app/api/materials/route.ts`
- Modify: `app/api/assessments/generate/route.ts`
- Modify: `app/api/assessments/[id]/submit/route.ts`
- Modify: `app/api/concept-maps/route.ts`
- Modify: `app/api/progress/route.ts`
- Modify: `app/api/recommendations/route.ts`
- Modify: `app/materials/page.tsx`
- Modify: `app/progress/page.tsx`
- Modify: `app/courses/[slug]/my-map/page.tsx`

- [ ] **Step 1: Find every call site**

Run: `grep -rn "ensureDemoUser" --include="*.ts" --include="*.tsx" .`
Expected: a list of roughly 10 files. Work through them in the order below.

- [ ] **Step 2: Replace in the Route Handlers**

In each of these files, remove the `ensureDemoUser` import and replace it:

```ts
// before
import { ensureDemoUser } from '@/lib/repositories/assessment'
const user = await ensureDemoUser()

// after
import { requireUser } from '@/lib/auth/guard'
const user = await requireUser()
```

Apply this to:
- `app/api/materials/route.ts` (both `GET` and `POST`)
- `app/api/assessments/generate/route.ts`
- `app/api/assessments/[id]/submit/route.ts`
- `app/api/concept-maps/route.ts` (both `GET` and `POST`)
- `app/api/progress/route.ts`
- `app/api/recommendations/route.ts`

`requireUser` throws an `ApiError` with status 401, and `handle` already converts that into the correct response — no extra error handling is needed.

- [ ] **Step 3: Replace in the Server Components**

Pages cannot throw a 401; they redirect. In each of `app/materials/page.tsx`, `app/progress/page.tsx` and `app/courses/[slug]/my-map/page.tsx`, replace the demo user call:

```tsx
// before
import { ensureDemoUser } from '@/lib/repositories/assessment'
const user = await ensureDemoUser()

// after
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

const user = await getSessionUser()
if (!user) redirect('/login')
```

- [ ] **Step 4: Delete `ensureDemoUser`**

Remove the function and the `DEMO_EMAIL` constant from `lib/repositories/assessment.ts`.

- [ ] **Step 5: Update the tests that used it**

Several repository tests call `ensureDemoUser` to get a user id. Replace that helper in each affected test file with a locally created user:

```ts
import prisma from '@/lib/prisma'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'repo-test@example.com' },
    create: {
      email: 'repo-test@example.com',
      passwordHash: 'unset',
      name: 'Repo Test',
    },
    update: {},
  })
}
```

Apply to `tests/repositories/assessment.test.ts`, `tests/repositories/material.test.ts`, `tests/repositories/student-map.test.ts`, and `tests/repositories/progress.test.ts`, replacing each `ensureDemoUser()` call with `testUser()`.

For the API tests that mocked `@/lib/repositories/assessment` to stub `ensureDemoUser`, change the mock to stub the guard instead:

```ts
const requireUser = vi.fn()
vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
// in beforeEach:
requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
```

Apply to `tests/api/materials.test.ts`, `tests/api/assessments.test.ts`, `tests/api/concept-maps.test.ts`, and `tests/api/progress.test.ts`.

- [ ] **Step 6: Verify no references remain**

Run: `grep -rn "ensureDemoUser" --include="*.ts" --include="*.tsx" .`
Expected: no output.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all tests pass. If a repository test fails on a foreign-key constraint, the test user is not being created before the data it owns — check the `beforeEach` ordering.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(auth): replace demo user with real session everywhere"
```

---

## Task 10: User menu and profile

**Files:**
- Create: `components/user-menu.tsx`
- Create: `app/profile/page.tsx`
- Modify: `components/app-shell.tsx`

- [ ] **Step 1: Create `components/user-menu.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/lib/schemas/auth'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu({ user }: { user: SessionUser | null }) {
  const router = useRouter()

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/login" />}>
          Sign in
        </Button>
        <Button size="sm" render={<Link href="/register" />}>
          Get started
        </Button>
      </div>
    )
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserIcon data-icon />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut data-icon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Wire it into `components/app-shell.tsx`**

The shell becomes async so it can read the session. Add the import and the lookup, then render the menu next to the theme toggle:

```tsx
import { getSessionUser } from '@/lib/auth/session'
import { UserMenu } from '@/components/user-menu'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  // ...
```

Replace the header's right-hand side:

```tsx
          <div className="ml-auto flex items-center gap-1">
            <ModeToggle />
            <UserMenu user={user} />
          </div>
```

- [ ] **Step 3: Hide the admin nav item from non-admins**

`NAV_ITEMS` in `components/nav-main.tsx` includes `/admin`. Give `NavMain` a `role` prop and filter:

```tsx
export function NavMain({ role }: { role?: 'USER' | 'ADMIN' }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter(
    (item) => item.href !== '/admin' || role === 'ADMIN',
  )
  // ...map over `items` instead of NAV_ITEMS
```

Then pass it from the shell: `<NavMain role={user?.role} />`.

- [ ] **Step 4: Create `app/profile/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getSessionUser } from '@/lib/auth/session'
import { getAllCourseProgress } from '@/lib/repositories/progress'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile — Adaptive' }

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const progress = await getAllCourseProgress(user.id)
  const totals = progress.reduce(
    (acc, p) => ({
      mastered: acc.mastered + p.masteredConcepts,
      started: acc.started + p.startedConcepts,
    }),
    { mastered: 0, started: 0 },
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account and overall activity.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{user.name}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
              {user.role.toLowerCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">
              {totals.started}
            </span>
            <span className="text-xs text-muted-foreground">
              concepts started
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">
              {totals.mastered}
            </span>
            <span className="text-xs text-muted-foreground">
              concepts mastered
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Smoke-test the whole flow**

Run: `npm run dev`.

Open `/register`, create an account. Expected: you land on `/progress` and the header shows your initials.

Open the avatar menu, click **Profile**. Expected: your name, email, a `user` badge, and zero counts.

Sign out. Expected: you land on `/` and the header shows **Sign in** / **Get started**.

Visit `/progress` while signed out. Expected: redirect to `/login?next=%2Fprogress`.

Sign in. Expected: you land back on `/progress`.

- [ ] **Step 6: Verify data isolation**

Register a second account in a private window. Take an assessment as that user, then check `/progress` in each window.

Expected: the two accounts show different mastery. If they share data, a call site still uses a hardcoded user id — re-run the grep from Task 9.

- [ ] **Step 7: Commit**

```bash
git add components/user-menu.tsx components/app-shell.tsx components/nav-main.tsx app/profile
git commit -m "feat(auth): add user menu, profile page and role-aware navigation"
```

---

## Task 11: Admin area

**Files:**
- Create: `app/api/admin/courses/route.ts`
- Create: `app/admin/page.tsx`
- Create: `scripts/make-admin.ts`
- Test: `tests/api/admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const listCourses = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireAdmin, requireUser: vi.fn() }))
vi.mock('@/lib/repositories/course', () => ({ listCourses }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/courses', () => {
  it('returns courses for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
    listCourses.mockResolvedValue([{ id: 'c1', title: 'Generative AI' }])
    const { GET } = await import('@/app/api/admin/courses/route')
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
    const { GET } = await import('@/app/api/admin/courses/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 401 when signed out', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Sign in to continue', 401),
    )
    const { GET } = await import('@/app/api/admin/courses/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('does not call the repository when authorisation fails', async () => {
    const { ApiError } = await import('@/lib/api')
    requireAdmin.mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403))
    const { GET } = await import('@/app/api/admin/courses/route')
    await GET()
    expect(listCourses).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/admin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/admin/courses/route.ts`**

```ts
import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { listCourses } from '@/lib/repositories/course'

export async function GET() {
  return handle(async () => {
    await requireAdmin()
    return ok(await listCourses({}))
  })
}
```

- [ ] **Step 4: Create `app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getSessionUser } from '@/lib/auth/session'
import { listCourses } from '@/lib/repositories/course'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Admin — Adaptive' }

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/progress')

  const [courses, userCount, assessmentCount, materialCount] =
    await Promise.all([
      listCourses({}),
      prisma.user.count(),
      prisma.assessment.count(),
      prisma.material.count(),
    ])

  const stats = [
    { label: 'Courses', value: courses.length },
    { label: 'Learners', value: userCount },
    { label: 'Assessments taken', value: assessmentCount },
    { label: 'Materials uploaded', value: materialCount },
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Platform content and activity.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-3xl font-semibold tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Courses</h2>
        <div className="flex flex-col gap-2">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <CardDescription>{course.category}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {course.moduleCount} modules
                    </Badge>
                    <Badge variant="secondary">
                      {course.conceptCount} concepts
                    </Badge>
                    <Link
                      href={`/courses/${course.slug}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Open ${course.title}`}
                    >
                      <ExternalLink data-icon className="size-4" />
                    </Link>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Create `scripts/make-admin.ts`**

There is no UI for promoting a user, and there should not be one in a prototype.

```ts
import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { role: 'ADMIN' },
    select: { email: true, role: true },
  })

  console.log(`${user.email} is now ${user.role}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/api/admin.test.ts`
Expected: PASS — `4 passed`.

- [ ] **Step 7: Promote your account and verify access control**

Run: `npx tsx scripts/make-admin.ts your@email.com`
Expected: `your@email.com is now ADMIN`.

Sign out and back in — the role is baked into the JWT, so an existing session still says USER.

Expected after re-signing in: **Admin** appears in the sidebar, `/admin` renders the stats and course list.

Now sign in as the second, non-admin account.
Expected: no **Admin** item in the sidebar, and visiting `/admin` directly redirects to `/progress`.

- [ ] **Step 8: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin app/admin scripts/make-admin.ts tests/api/admin.test.ts
git commit -m "feat(admin): add admin dashboard, course endpoint and promotion script"
```

---

## Phase 8 Exit Checklist

- [ ] Registration creates an account and signs the user in
- [ ] Passwords are stored as bcrypt hashes, never plaintext
- [ ] Login failure gives an identical message for unknown email and wrong password
- [ ] The session cookie is httpOnly, sameSite lax, and secure in production
- [ ] `proxy.ts` (not `middleware.ts`) redirects signed-out users away from protected routes
- [ ] Every Route Handler calls `requireUser` independently — the proxy is not the authorisation boundary
- [ ] `grep -rn "ensureDemoUser"` returns nothing
- [ ] Two accounts see completely separate progress, materials and maps
- [ ] A non-admin cannot see the Admin nav item or reach `/admin`
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-09-polish.md`](./phase-09-polish.md).
