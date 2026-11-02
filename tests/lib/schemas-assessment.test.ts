import { describe, expect, it } from 'vitest'
import {
  generatedQuestionSchema,
  generatedQuizSchema,
  shortAnswerEvaluationSchema,
  submissionSchema,
} from '@/lib/schemas/assessment'

const mcq = {
  type: 'MCQ' as const,
  prompt: 'What is a token?',
  options: ['A subword unit', 'A whole word', 'A character', 'A sentence'],
  correctAnswer: 'A subword unit',
  explanation: 'Tokenizers emit subword units from a fixed vocabulary.',
  conceptName: 'Tokenization',
  difficulty: 'BEGINNER' as const,
}

const short = {
  type: 'SHORT_ANSWER' as const,
  prompt: 'Why do models use subwords rather than whole words?',
  options: [],
  correctAnswer: 'Subwords bound vocabulary size while still covering rare words.',
  explanation: 'A whole-word vocabulary cannot cover unseen words.',
  conceptName: 'Tokenization',
  difficulty: 'INTERMEDIATE' as const,
}

describe('generatedQuestionSchema', () => {
  it('accepts a well formed MCQ', () => {
    expect(generatedQuestionSchema.parse(mcq).type).toBe('MCQ')
  })

  it('accepts a well formed short answer question', () => {
    expect(generatedQuestionSchema.parse(short).type).toBe('SHORT_ANSWER')
  })

  it('rejects an MCQ with fewer than two options', () => {
    const result = generatedQuestionSchema.safeParse({
      ...mcq,
      options: ['only one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an MCQ whose correctAnswer is not among the options', () => {
    const result = generatedQuestionSchema.safeParse({
      ...mcq,
      correctAnswer: 'Not in the list',
    })
    expect(result.success).toBe(false)
  })

  it('does not require correctAnswer to be in options for a short answer', () => {
    expect(generatedQuestionSchema.safeParse(short).success).toBe(true)
  })

  it('rejects an empty explanation', () => {
    expect(
      generatedQuestionSchema.safeParse({ ...mcq, explanation: '' }).success,
    ).toBe(false)
  })
})

describe('generatedQuizSchema', () => {
  it('accepts a quiz with questions', () => {
    expect(generatedQuizSchema.parse({ questions: [mcq, short] }).questions).toHaveLength(2)
  })

  it('rejects an empty quiz', () => {
    expect(generatedQuizSchema.safeParse({ questions: [] }).success).toBe(false)
  })

  it('rejects more than ten questions', () => {
    const questions = Array.from({ length: 11 }, () => mcq)
    expect(generatedQuizSchema.safeParse({ questions }).success).toBe(false)
  })
})

describe('shortAnswerEvaluationSchema', () => {
  const evaluation = {
    correctness: 0.8,
    understoodConcepts: ['Tokenization'],
    misunderstoodConcepts: [],
    missingPoints: ['Did not mention vocabulary size'],
    feedback: 'Close. You identified the coverage benefit but not the size bound.',
  }

  it('accepts a well formed evaluation', () => {
    expect(shortAnswerEvaluationSchema.parse(evaluation).correctness).toBe(0.8)
  })

  it('rejects correctness above 1', () => {
    expect(
      shortAnswerEvaluationSchema.safeParse({ ...evaluation, correctness: 1.5 })
        .success,
    ).toBe(false)
  })

  it('rejects correctness below 0', () => {
    expect(
      shortAnswerEvaluationSchema.safeParse({ ...evaluation, correctness: -0.1 })
        .success,
    ).toBe(false)
  })

  it('defaults the list fields to empty arrays', () => {
    const parsed = shortAnswerEvaluationSchema.parse({
      correctness: 1,
      feedback: 'Correct.',
    })
    expect(parsed.understoodConcepts).toEqual([])
    expect(parsed.misunderstoodConcepts).toEqual([])
    expect(parsed.missingPoints).toEqual([])
  })
})

describe('submissionSchema', () => {
  it('accepts a list of responses', () => {
    const parsed = submissionSchema.parse({
      responses: [{ questionId: 'q1', response: 'A subword unit' }],
    })
    expect(parsed.responses).toHaveLength(1)
  })

  it('rejects an empty responses array', () => {
    expect(submissionSchema.safeParse({ responses: [] }).success).toBe(false)
  })

  it('allows an empty response string for a skipped question', () => {
    expect(
      submissionSchema.safeParse({
        responses: [{ questionId: 'q1', response: '' }],
      }).success,
    ).toBe(true)
  })
})
