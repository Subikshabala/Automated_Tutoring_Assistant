import { describe, expect, it } from 'vitest'
import { gradeMcq } from '@/lib/grading'

describe('gradeMcq', () => {
  it('scores an exact match as fully correct', () => {
    expect(gradeMcq('A subword unit', 'A subword unit')).toEqual({
      isCorrect: true,
      score: 1,
    })
  })

  it('scores a mismatch as incorrect', () => {
    expect(gradeMcq('A whole word', 'A subword unit')).toEqual({
      isCorrect: false,
      score: 0,
    })
  })

  it('ignores surrounding whitespace', () => {
    expect(gradeMcq('  A subword unit  ', 'A subword unit').isCorrect).toBe(true)
  })

  it('ignores case differences', () => {
    expect(gradeMcq('a SUBWORD unit', 'A subword unit').isCorrect).toBe(true)
  })

  it('treats an empty response as incorrect', () => {
    expect(gradeMcq('', 'A subword unit')).toEqual({
      isCorrect: false,
      score: 0,
    })
  })

  it('does not treat a substring as a match', () => {
    expect(gradeMcq('subword', 'A subword unit').isCorrect).toBe(false)
  })
})
