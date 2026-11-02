import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  listOpenMisconceptions,
  recordMisconception,
  resolveMisconception,
} from '@/lib/repositories/misconception'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'misc-test@example.com' },
    create: { email: 'misc-test@example.com', passwordHash: 'x', name: 'T' },
    update: {},
  })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.misconception.deleteMany({ where: { userId: user.id } })
})

describe('recordMisconception', () => {
  it('stores a new misconception', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordMisconception({
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'Said "each word becomes one token"',
    })
    const open = await listOpenMisconceptions(user.id)
    expect(open).toHaveLength(1)
    expect(open[0].description).toContain('whole words')
  })

  it('does not duplicate the same misconception', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'first attempt',
    }
    await recordMisconception(input)
    await recordMisconception({ ...input, evidence: 'second attempt' })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(1)
  })

  it('appends new evidence to an existing record', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'first attempt',
    }
    await recordMisconception(input)
    await recordMisconception({ ...input, evidence: 'second attempt' })
    const [open] = await listOpenMisconceptions(user.id)
    expect(open.evidence).toContain('first attempt')
    expect(open.evidence).toContain('second attempt')
  })

  it('reopens a resolved misconception that recurs', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'e1',
    }
    await recordMisconception(input)
    const [first] = await listOpenMisconceptions(user.id)
    await resolveMisconception(first.id)
    expect(await listOpenMisconceptions(user.id)).toHaveLength(0)

    await recordMisconception({ ...input, evidence: 'e2' })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(1)
  })

  it('keeps misconceptions on different concepts separate', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Tokenization'),
      description: 'Same wording',
      evidence: 'e',
    })
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Embeddings'),
      description: 'Same wording',
      evidence: 'e',
    })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(2)
  })
})

describe('listOpenMisconceptions', () => {
  it('returns an empty array for a clean learner', async () => {
    const user = await testUser()
    await expect(listOpenMisconceptions(user.id)).resolves.toEqual([])
  })

  it('includes the concept name for display', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Tokenization'),
      description: 'd',
      evidence: 'e',
    })
    const [open] = await listOpenMisconceptions(user.id)
    expect(open.conceptName).toBe('Tokenization')
  })

  it('orders most recent first', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Tokenization'),
      description: 'older', evidence: 'e',
    })
    await new Promise((r) => setTimeout(r, 20))
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Embeddings'),
      description: 'newer', evidence: 'e',
    })
    const open = await listOpenMisconceptions(user.id)
    expect(open[0].description).toBe('newer')
  })

  it('excludes resolved entries', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Tokenization'),
      description: 'd', evidence: 'e',
    })
    const [open] = await listOpenMisconceptions(user.id)
    await resolveMisconception(open.id)
    expect(await listOpenMisconceptions(user.id)).toEqual([])
  })
})

describe('resolveMisconception', () => {
  it('ignores an unknown id', async () => {
    await expect(resolveMisconception('nope')).resolves.not.toThrow()
  })
})
