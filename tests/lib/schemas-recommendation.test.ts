import { describe, expect, it } from 'vitest'
import {
  coachSummarySchema,
  courseProgressSchema,
  recommendationSchema,
} from '@/lib/schemas/recommendation'

describe('recommendationSchema', () => {
  const recommendation = {
    conceptId: 'c1',
    conceptName: 'Attention',
    courseSlug: 'generative-ai',
    topicId: 't1',
    action: 'LEARN' as const,
    situation: 'READY' as const,
    reason: 'You have not started this yet and its prerequisites are met.',
    priority: 82,
    masteryScore: 0,
    unlocks: [],
    prerequisites: [],
  }

  it('accepts a well formed recommendation', () => {
    expect(recommendationSchema.parse(recommendation).action).toBe('LEARN')
  })

  it('accepts every valid action', () => {
    for (const action of ['LEARN', 'PRACTISE', 'REVIEW']) {
      expect(
        recommendationSchema.safeParse({ ...recommendation, action }).success,
      ).toBe(true)
    }
  })

  it('rejects an unknown action', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, action: 'SKIP' })
        .success,
    ).toBe(false)
  })

  it('rejects a priority above 100', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, priority: 101 })
        .success,
    ).toBe(false)
  })

  it('rejects an empty reason', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, reason: '' }).success,
    ).toBe(false)
  })

  it('allows a null topicId', () => {
    expect(
      recommendationSchema.parse({ ...recommendation, topicId: null }).topicId,
    ).toBeNull()
  })
})

describe('courseProgressSchema', () => {
  const progress = {
    courseSlug: 'generative-ai',
    courseTitle: 'Generative AI Foundations',
    totalConcepts: 11,
    startedConcepts: 4,
    masteredConcepts: 2,
    averageMastery: 58,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well formed progress record', () => {
    expect(courseProgressSchema.parse(progress).totalConcepts).toBe(11)
  })

  it('allows a null lastActivityAt for an untouched course', () => {
    expect(
      courseProgressSchema.parse({ ...progress, lastActivityAt: null })
        .lastActivityAt,
    ).toBeNull()
  })

  it('rejects an average mastery above 100', () => {
    expect(
      courseProgressSchema.safeParse({ ...progress, averageMastery: 101 })
        .success,
    ).toBe(false)
  })
})

describe('coachSummarySchema', () => {
  it('accepts a well formed summary', () => {
    const parsed = coachSummarySchema.parse({
      headline: 'Strong week on the fundamentals.',
      body: 'You mastered tokenization and embeddings. Attention is next.',
    })
    expect(parsed.headline).toContain('Strong')
  })

  it('rejects an empty headline', () => {
    expect(
      coachSummarySchema.safeParse({ headline: '', body: 'x' }).success,
    ).toBe(false)
  })
})
