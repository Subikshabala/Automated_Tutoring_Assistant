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
