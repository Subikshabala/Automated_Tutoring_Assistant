import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/client', () => ({ generateStructured }))

const quiz = {
  questions: [
    {
      type: 'MCQ' as const,
      prompt: 'What is a token?',
      options: ['A subword unit', 'A whole word', 'A character', 'A sentence'],
      correctAnswer: 'A subword unit',
      explanation: 'Tokenizers emit subword units.',
      conceptName: 'Tokenization',
      difficulty: 'BEGINNER' as const,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateQuestions', () => {
  it('returns the validated quiz', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    const result = await generateQuestions({
      courseTitle: 'Generative AI Foundations',
      topicTitle: 'Text Representation',
      concepts: [{ name: 'Tokenization', definition: 'Splitting text.' }],
      questionCount: 1,
    })
    expect(result.questions).toHaveLength(1)
  })

  it('includes every concept name in the prompt', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    await generateQuestions({
      courseTitle: 'C',
      topicTitle: 'T',
      concepts: [
        { name: 'Tokenization', definition: 'a' },
        { name: 'Embeddings', definition: 'b' },
      ],
      questionCount: 2,
    })
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('Tokenization')
    expect(prompt).toContain('Embeddings')
  })

  it('uses a low temperature for consistency', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    await generateQuestions({
      courseTitle: 'C',
      topicTitle: 'T',
      concepts: [{ name: 'X', definition: 'y' }],
      questionCount: 1,
    })
    expect(generateStructured.mock.calls[0][0].temperature).toBeLessThanOrEqual(0.4)
  })
})

describe('evaluateShortAnswer', () => {
  const evaluation = {
    correctness: 0.8,
    understoodConcepts: ['Tokenization'],
    misunderstoodConcepts: [],
    missingPoints: [],
    feedback: 'Good.',
  }

  it('returns the validated evaluation', async () => {
    generateStructured.mockResolvedValue(evaluation)
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    const result = await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'Splitting text.',
      question: 'Why subwords?',
      modelAnswer: 'Coverage and vocabulary size.',
      learnerAnswer: 'So rare words still work.',
    })
    expect(result.correctness).toBe(0.8)
  })

  it('includes the learner answer in the prompt', async () => {
    generateStructured.mockResolvedValue(evaluation)
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'd',
      question: 'q',
      modelAnswer: 'm',
      learnerAnswer: 'my unique answer text',
    })
    expect(generateStructured.mock.calls[0][0].prompt).toContain(
      'my unique answer text',
    )
  })

  it('returns zero without calling the model for a blank answer', async () => {
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    const result = await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'd',
      question: 'q',
      modelAnswer: 'm',
      learnerAnswer: '   ',
    })
    expect(result.correctness).toBe(0)
    expect(generateStructured).not.toHaveBeenCalled()
  })
})
