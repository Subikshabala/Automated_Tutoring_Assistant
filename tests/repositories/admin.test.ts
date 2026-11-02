import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { listLearnerOverview, getPlatformStats } from '@/lib/repositories/admin'
import { recordAttempt } from '@/lib/repositories/mastery'

async function learner(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: 'x', name: email.split('@')[0] },
    update: {},
  })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  await prisma.mastery.deleteMany({
    where: { user: { email: { contains: 'admin-test' } } },
  })
  await prisma.user.deleteMany({
    where: { email: { contains: 'admin-test' } },
  })
})

describe('listLearnerOverview', () => {
  it('returns every learner', async () => {
    await learner('admin-test-a@example.com')
    await learner('admin-test-b@example.com')
    const rows = await listLearnerOverview()
    const emails = rows.map((r) => r.email)
    expect(emails).toContain('admin-test-a@example.com')
    expect(emails).toContain('admin-test-b@example.com')
  })

  it('reports zero activity for a new account', async () => {
    const u = await learner('admin-test-new@example.com')
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsStarted).toBe(0)
    expect(row!.conceptsMastered).toBe(0)
  })

  it('counts started concepts', async () => {
    const u = await learner('admin-test-active@example.com')
    await recordAttempt(u.id, await conceptId('Tokenization'), 0.6)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsStarted).toBe(1)
  })

  it('counts mastered separately from started', async () => {
    const u = await learner('admin-test-master@example.com')
    const id = await conceptId('Tokenization')
    await recordAttempt(u.id, id, 1)
    await recordAttempt(u.id, id, 1)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsMastered).toBe(1)
  })

  it('flags a learner who is struggling', async () => {
    const u = await learner('admin-test-stuck@example.com')
    await recordAttempt(u.id, await conceptId('Tokenization'), 0)
    await recordAttempt(u.id, await conceptId('Embeddings'), 0)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.needsReview).toBeGreaterThanOrEqual(2)
  })

  it('reports the role', async () => {
    const u = await learner('admin-test-role@example.com')
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.role).toBe('USER')
  })

  it('never exposes the password hash', async () => {
    await learner('admin-test-safe@example.com')
    const rows = await listLearnerOverview()
    expect(rows[0]).not.toHaveProperty('passwordHash')
  })

  it('orders most recently active first', async () => {
    const quiet = await learner('admin-test-quiet@example.com')
    const busy = await learner('admin-test-busy@example.com')
    await recordAttempt(busy.id, await conceptId('Tokenization'), 0.5)
    const rows = await listLearnerOverview()
    const busyIndex = rows.findIndex((r) => r.id === busy.id)
    const quietIndex = rows.findIndex((r) => r.id === quiet.id)
    expect(busyIndex).toBeLessThan(quietIndex)
  })
})

describe('getPlatformStats', () => {
  it('returns the headline counters', async () => {
    const stats = await getPlatformStats()
    expect(stats.courses).toBeGreaterThan(0)
    expect(typeof stats.learners).toBe('number')
    expect(typeof stats.assessmentsTaken).toBe('number')
    expect(typeof stats.materialsUploaded).toBe('number')
  })

  it('reports concepts with no mastery data anywhere', async () => {
    const stats = await getPlatformStats()
    expect(typeof stats.untouchedConcepts).toBe('number')
  })

  it('reports open misconceptions across the platform', async () => {
    const stats = await getPlatformStats()
    expect(typeof stats.openMisconceptions).toBe('number')
  })
})
