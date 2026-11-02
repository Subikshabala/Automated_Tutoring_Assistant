import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  getMastery,
  listMasteryForCourse,
  recordAttempt,
} from '@/lib/repositories/mastery'

const TEST_USER = 'mastery-test-user'

async function conceptId(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

beforeEach(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER },
    create: {
      id: TEST_USER,
      email: 'mastery-test@example.com',
      passwordHash: 'x',
      name: 'Mastery Test',
    },
    update: {},
  })
})

afterEach(async () => {
  await prisma.mastery.deleteMany({ where: { userId: TEST_USER } })
})

describe('getMastery', () => {
  it('returns null when the learner has no record for the concept', async () => {
    await expect(
      getMastery(TEST_USER, await conceptId('Tokenization')),
    ).resolves.toBeNull()
  })
})

describe('recordAttempt', () => {
  it('creates a record on the first attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.masteryScore).toBe(100)
    expect(result.attemptCount).toBe(1)
  })

  it('sets the status to PRACTICING after one perfect attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.status).toBe('PRACTICING')
  })

  it('awards MASTERED after two perfect attempts', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.status).toBe('MASTERED')
  })

  it('sets NEEDS_REVIEW after a failed attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 0)
    expect(result.status).toBe('NEEDS_REVIEW')
  })

  it('accumulates attempt counts across calls', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    await recordAttempt(TEST_USER, id, 0)
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.attemptCount).toBe(3)
    expect(result.correctCount).toBe(2)
    expect(result.incorrectCount).toBe(1)
  })

  it('stamps lastAssessmentAt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.lastAssessmentAt).toBeInstanceOf(Date)
  })
})

describe('listMasteryForCourse', () => {
  it('returns only concepts the learner has attempted', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    const rows = await listMasteryForCourse(TEST_USER, 'generative-ai')
    expect(rows).toHaveLength(1)
    expect(rows[0].conceptName).toBe('Tokenization')
  })

  it('returns an empty array for an untouched course', async () => {
    await expect(
      listMasteryForCourse(TEST_USER, 'ai-agents'),
    ).resolves.toEqual([])
  })
})
