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
