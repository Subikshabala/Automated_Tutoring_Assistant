import { describe, expect, it } from 'vitest'
import {
  applyAttempt,
  masteryStatusFor,
  recommendationFor,
} from '@/lib/mastery'

const fresh = {
  masteryScore: 0,
  confidenceScore: 0,
  attemptCount: 0,
  correctCount: 0,
  incorrectCount: 0,
}

describe('masteryStatusFor', () => {
  it('returns NOT_STARTED with no attempts', () => {
    expect(masteryStatusFor(0, 0)).toBe('NOT_STARTED')
  })

  it('returns NEEDS_REVIEW below 50', () => {
    expect(masteryStatusFor(30, 3)).toBe('NEEDS_REVIEW')
  })

  it('returns LEARNING from 50 to 64', () => {
    expect(masteryStatusFor(55, 3)).toBe('LEARNING')
  })

  it('returns PRACTICING from 65 to 79', () => {
    expect(masteryStatusFor(70, 3)).toBe('PRACTICING')
  })

  it('returns MASTERED at 80 and above', () => {
    expect(masteryStatusFor(80, 3)).toBe('MASTERED')
  })

  it('does not award MASTERED on a single attempt', () => {
    expect(masteryStatusFor(100, 1)).toBe('PRACTICING')
  })
})

describe('applyAttempt', () => {
  it('sets the score to 100 after one fully correct attempt', () => {
    const next = applyAttempt(fresh, 1)
    expect(next.masteryScore).toBe(100)
    expect(next.correctCount).toBe(1)
    expect(next.attemptCount).toBe(1)
  })

  it('sets the score to 0 after one fully incorrect attempt', () => {
    const next = applyAttempt(fresh, 0)
    expect(next.masteryScore).toBe(0)
    expect(next.incorrectCount).toBe(1)
  })

  it('counts a partial score above 0.5 as correct', () => {
    const next = applyAttempt(fresh, 0.8)
    expect(next.correctCount).toBe(1)
    expect(next.incorrectCount).toBe(0)
  })

  it('counts a partial score at or below 0.5 as incorrect', () => {
    const next = applyAttempt(fresh, 0.5)
    expect(next.correctCount).toBe(0)
    expect(next.incorrectCount).toBe(1)
  })

  it('weights recent attempts more heavily than old ones', () => {
    const afterFailure = applyAttempt(fresh, 0)
    const afterSuccess = applyAttempt(afterFailure, 1)
    expect(afterSuccess.masteryScore).toBeGreaterThan(50)
  })

  it('keeps the score within 0 and 100', () => {
    let state = fresh
    for (let i = 0; i < 10; i++) state = applyAttempt(state, 1)
    expect(state.masteryScore).toBeLessThanOrEqual(100)

    let low = fresh
    for (let i = 0; i < 10; i++) low = applyAttempt(low, 0)
    expect(low.masteryScore).toBeGreaterThanOrEqual(0)
  })

  it('raises confidence as attempts accumulate', () => {
    const one = applyAttempt(fresh, 1)
    const two = applyAttempt(one, 1)
    expect(two.confidenceScore).toBeGreaterThan(one.confidenceScore)
  })

  it('caps confidence at 1', () => {
    let state = fresh
    for (let i = 0; i < 20; i++) state = applyAttempt(state, 1)
    expect(state.confidenceScore).toBeLessThanOrEqual(1)
  })
})

describe('recommendationFor', () => {
  it('recommends advancing at 80 and above', () => {
    expect(recommendationFor(85)).toBe('ADVANCE')
  })

  it('recommends practice between 50 and 79', () => {
    expect(recommendationFor(60)).toBe('PRACTICE')
  })

  it('recommends reteaching below 50', () => {
    expect(recommendationFor(30)).toBe('RETEACH')
  })
})
