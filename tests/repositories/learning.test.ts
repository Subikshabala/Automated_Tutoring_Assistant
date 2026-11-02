import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  endSession,
  getConceptProgress,
  getResumePoint,
  recordConceptView,
  startSession,
} from '@/lib/repositories/learning'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'learning-test@example.com' },
    create: { email: 'learning-test@example.com', passwordHash: 'x', name: 'T' },
    update: {},
  })
}
async function firstTopic() {
  return prisma.topic.findFirstOrThrow({ where: { title: 'Text Representation' } })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.learningSession.deleteMany({ where: { userId: user.id } })
  await prisma.learningProgress.deleteMany({ where: { userId: user.id } })
})

describe('startSession', () => {
  it('creates an open session', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    expect(session.endedAt).toBeNull()
  })

  it('reuses an open session for the same topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const first = await startSession(user.id, topic.id)
    const second = await startSession(user.id, topic.id)
    expect(second.id).toBe(first.id)
  })

  it('closes a stale session on a different topic', async () => {
    const user = await testUser()
    const topics = await prisma.topic.findMany({ take: 2 })
    await startSession(user.id, topics[0].id)
    await startSession(user.id, topics[1].id)
    const open = await prisma.learningSession.findMany({
      where: { userId: user.id, endedAt: null },
    })
    expect(open).toHaveLength(1)
  })

  it('resolves the course from the topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    expect(session.courseId).toBeTruthy()
  })
})

describe('endSession', () => {
  it('stamps endedAt', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    await endSession(session.id)
    const row = await prisma.learningSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(row.endedAt).not.toBeNull()
  })

  it('is safe to call twice', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    await endSession(session.id)
    await expect(endSession(session.id)).resolves.not.toThrow()
  })

  it('ignores an unknown id', async () => {
    await expect(endSession('nope')).resolves.not.toThrow()
  })
})

describe('recordConceptView', () => {
  it('creates a progress row on first view', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 30)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(30)
  })

  it('accumulates time across views', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 30)
    await recordConceptView(user.id, id, 45)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(75)
  })

  it('marks completed past the threshold', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 120)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.completed).toBe(true)
  })

  it('leaves a brief view incomplete', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 5)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.completed).toBe(false)
  })

  it('refreshes lastViewedAt', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 10)
    const first = (await getConceptProgress(user.id, id))!.lastViewedAt
    await new Promise((r) => setTimeout(r, 20))
    await recordConceptView(user.id, id, 10)
    const second = (await getConceptProgress(user.id, id))!.lastViewedAt
    expect(second.getTime()).toBeGreaterThan(first.getTime())
  })

  it('rejects a negative duration', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, -50)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(0)
  })

  it('caps an implausible single view', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 100_000)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBeLessThanOrEqual(3600)
  })
})

describe('getResumePoint', () => {
  it('returns null for a learner with no history', async () => {
    const user = await testUser()
    await expect(getResumePoint(user.id)).resolves.toBeNull()
  })

  it('returns the most recent topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    await startSession(user.id, topic.id)
    const resume = await getResumePoint(user.id)
    expect(resume!.topicId).toBe(topic.id)
  })

  it('includes the course slug for linking', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    await startSession(user.id, topic.id)
    const resume = await getResumePoint(user.id)
    expect(resume!.courseSlug).toBe('generative-ai')
  })
})
