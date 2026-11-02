import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { recordAttempt } from '@/lib/repositories/mastery'
import { getAllCourseProgress } from '@/lib/repositories/progress'

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

async function conceptId(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.mastery.deleteMany({ where: { userId: user.id } })
})

describe('getAllCourseProgress', () => {
  it('returns one row per published course', async () => {
    const user = await testUser()
    const progress = await getAllCourseProgress(user.id)
    expect(progress).toHaveLength(3)
  })

  it('reports the total concept count per course', async () => {
    const user = await testUser()
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.totalConcepts).toBe(11)
  })

  it('reports zero started for an untouched course', async () => {
    const user = await testUser()
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.startedConcepts).toBe(0)
    expect(genAi!.averageMastery).toBe(0)
    expect(genAi!.lastActivityAt).toBeNull()
  })

  it('counts a started concept after one attempt', async () => {
    const user = await testUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 0.6)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.startedConcepts).toBe(1)
  })

  it('counts a mastered concept after two strong attempts', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordAttempt(user.id, id, 1)
    await recordAttempt(user.id, id, 1)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.masteredConcepts).toBe(1)
  })

  it('averages mastery across started concepts only', async () => {
    const user = await testUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    await recordAttempt(user.id, await conceptId('Embeddings'), 0)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.averageMastery).toBe(50)
  })

  it('sets lastActivityAt once there is activity', async () => {
    const user = await testUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.lastActivityAt).not.toBeNull()
  })

  it('does not leak activity from one course into another', async () => {
    const user = await testUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    const progress = await getAllCourseProgress(user.id)
    const agents = progress.find((p) => p.courseSlug === 'ai-agents')
    expect(agents!.startedConcepts).toBe(0)
  })
})
