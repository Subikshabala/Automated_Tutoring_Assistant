import { describe, expect, it } from 'vitest'
import {
  conceptExplanationSchema,
  tutorAnswerSchema,
} from '@/lib/schemas/ai'

const validExplanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens before processing it.',
  whyItMatters: 'Token count drives both cost and context limits.',
  example: 'The word "tokenization" might split into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why do models not operate on whole words?',
}

describe('conceptExplanationSchema', () => {
  it('accepts a well formed explanation', () => {
    expect(conceptExplanationSchema.parse(validExplanation).title).toBe(
      'Tokenization',
    )
  })

  it('rejects an empty simpleExplanation', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      simpleExplanation: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects fewer than two key points', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      keyPoints: ['only one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than six key points', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      keyPoints: ['1', '2', '3', '4', '5', '6', '7'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing checkQuestion', () => {
    const { checkQuestion: _omitted, ...rest } = validExplanation
    expect(conceptExplanationSchema.safeParse(rest).success).toBe(false)
  })
})

describe('tutorAnswerSchema', () => {
  const validAnswer = {
    answer: 'Because subword units balance vocabulary size against coverage.',
    relatedConcepts: ['Embeddings'],
    followUpQuestion: 'What happens to a word the tokenizer has never seen?',
  }

  it('accepts a well formed answer', () => {
    expect(tutorAnswerSchema.parse(validAnswer).answer).toContain('subword')
  })

  it('defaults relatedConcepts to an empty array', () => {
    const { relatedConcepts: _omitted, ...rest } = validAnswer
    expect(tutorAnswerSchema.parse(rest).relatedConcepts).toEqual([])
  })

  it('allows a null followUpQuestion', () => {
    const parsed = tutorAnswerSchema.parse({
      ...validAnswer,
      followUpQuestion: null,
    })
    expect(parsed.followUpQuestion).toBeNull()
  })

  it('rejects an empty answer', () => {
    expect(
      tutorAnswerSchema.safeParse({ ...validAnswer, answer: '' }).success,
    ).toBe(false)
  })
})
