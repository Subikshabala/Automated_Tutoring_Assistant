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
