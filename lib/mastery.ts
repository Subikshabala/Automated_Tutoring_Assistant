import type { MasteryStatus } from '@/lib/schemas/common'

export type MasteryState = {
  masteryScore: number
  confidenceScore: number
  attemptCount: number
  correctCount: number
  incorrectCount: number
}

export type Recommendation = 'ADVANCE' | 'PRACTICE' | 'RETEACH'

/** Weight given to the newest attempt. Older attempts decay geometrically. */
const RECENCY_WEIGHT = 0.6

/** Attempts needed before MASTERED can be awarded. */
const MASTERY_MIN_ATTEMPTS = 2

export function masteryStatusFor(
  score: number,
  attemptCount: number,
): MasteryStatus {
  if (attemptCount === 0) return 'NOT_STARTED'
  if (score < 50) return 'NEEDS_REVIEW'
  if (score < 65) return 'LEARNING'
  if (score < 80) return 'PRACTICING'
  return attemptCount >= MASTERY_MIN_ATTEMPTS ? 'MASTERED' : 'PRACTICING'
}

/**
 * Exponential moving average over attempt scores.
 * `attemptScore` is 0..1; `masteryScore` is 0..100.
 */
export function applyAttempt(
  state: MasteryState,
  attemptScore: number,
): MasteryState {
  const clamped = Math.min(1, Math.max(0, attemptScore))
  const asPercent = clamped * 100

  const masteryScore =
    state.attemptCount === 0
      ? asPercent
      : state.masteryScore * (1 - RECENCY_WEIGHT) + asPercent * RECENCY_WEIGHT

  const attemptCount = state.attemptCount + 1
  const wasCorrect = clamped > 0.5

  return {
    masteryScore: Math.min(100, Math.max(0, Math.round(masteryScore))),
    confidenceScore: Math.min(1, attemptCount / 5),
    attemptCount,
    correctCount: state.correctCount + (wasCorrect ? 1 : 0),
    incorrectCount: state.incorrectCount + (wasCorrect ? 0 : 1),
  }
}

export function recommendationFor(score: number): Recommendation {
  if (score >= 80) return 'ADVANCE'
  if (score >= 50) return 'PRACTICE'
  return 'RETEACH'
}
