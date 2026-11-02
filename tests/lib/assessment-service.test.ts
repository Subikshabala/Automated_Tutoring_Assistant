import { beforeEach, describe, expect, it, vi } from 'vitest'

const findQuestionsForGrading = vi.fn()
const saveAnswers = vi.fn()
const recordAttempt = vi.fn()
const evaluateShortAnswer = vi.fn()
const recordMisconception = vi.fn()
const resolveMisconceptionsForConcept = vi.fn()

vi.mock('@/lib/repositories/assessment', () => ({
  findQuestionsForGrading,
  saveAnswers,
}))
vi.mock('@/lib/repositories/mastery', () => ({ recordAttempt }))
vi.mock('@/lib/ai/assessment', () => ({ evaluateShortAnswer }))
vi.mock('@/lib/repositories/misconception', () => ({
  recordMisconception,
  resolveMisconceptionsForConcept,
}))

const mcqQuestion = {
  id: 'q1',
  type: 'MCQ' as const,
  prompt: 'What is a token?',
  correctAnswer: 'A subword unit',
  explanation: 'Subword units.',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text.',
}

const shortQuestion = {
  id: 'q2',
  type: 'SHORT_ANSWER' as const,
  prompt: 'Why subwords?',
  correctAnswer: 'Coverage and size.',
  explanation: 'Both matter.',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text.',
}

beforeEach(() => {
  vi.clearAllMocks()
  recordAttempt.mockResolvedValue({ masteryScore: 100, status: 'PRACTICING' })
})

describe('gradeSubmission', () => {
  it('grades a correct MCQ without calling the model', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
    ])
    expect(result.results[0].isCorrect).toBe(true)
    expect(result.results[0].score).toBe(1)
    expect(evaluateShortAnswer).not.toHaveBeenCalled()
  })

  it('grades an incorrect MCQ', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A whole word' },
    ])
    expect(result.results[0].isCorrect).toBe(false)
  })

  it('returns the correct answer and explanation after grading', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A whole word' },
    ])
    expect(result.results[0].correctAnswer).toBe('A subword unit')
    expect(result.results[0].explanation).toBe('Subword units.')
  })

  it('sends short answers to the model', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.75,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Close.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q2', response: 'Rare words still work.' },
    ])
    expect(evaluateShortAnswer).toHaveBeenCalledOnce()
    expect(result.results[0].score).toBe(0.75)
    expect(result.results[0].isCorrect).toBe(true)
  })

  it('computes the overall score as a percentage', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion, shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.5,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Partial.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
      { questionId: 'q2', response: 'something' },
    ])
    expect(result.score).toBe(75)
  })

  it('records one mastery attempt per concept, averaging its questions', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion, shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.5,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Partial.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
      { questionId: 'q2', response: 'something' },
    ])
    expect(recordAttempt).toHaveBeenCalledTimes(1)
    expect(recordAttempt).toHaveBeenCalledWith('u1', 'c1', 0.75)
  })

  it('persists the answers', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
    ])
    expect(saveAnswers).toHaveBeenCalledWith('a1', 100, expect.any(Array))
  })

  it('scores an unanswered question as zero', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [])
    expect(result.results[0].score).toBe(0)
    expect(result.score).toBe(0)
  })

  it('throws NOT_FOUND when the assessment has no questions', async () => {
    findQuestionsForGrading.mockResolvedValue([])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await expect(gradeSubmission('a1', 'u1', [])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('records a misconception from a misunderstood concept', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.3,
      understoodConcepts: [],
      misunderstoodConcepts: ['Treats tokens as whole words'],
      missingPoints: [],
      feedback: 'Not quite.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'wrong' }])
    expect(recordMisconception).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        conceptId: 'c1',
        description: 'Treats tokens as whole words',
      }),
    )
  })

  it('includes the learner answer as evidence', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.3, understoodConcepts: [],
      misunderstoodConcepts: ['Confuses X with Y'],
      missingPoints: [], feedback: 'f',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [
      { questionId: 'q2', response: 'my specific wrong answer' },
    ])
    expect(recordMisconception.mock.calls[0][0].evidence).toContain(
      'my specific wrong answer',
    )
  })

  it('does not record anything for a correct answer', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.95, understoodConcepts: ['Tokenization'],
      misunderstoodConcepts: [], missingPoints: [], feedback: 'Good.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'right' }])
    expect(recordMisconception).not.toHaveBeenCalled()
  })

  it('records one entry per misunderstood concept', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.2, understoodConcepts: [],
      misunderstoodConcepts: ['First error', 'Second error'],
      missingPoints: [], feedback: 'f',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'x' }])
    expect(recordMisconception).toHaveBeenCalledTimes(2)
  })

  it('does not record for MCQ questions', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [{ questionId: 'q1', response: 'wrong' }])
    expect(recordMisconception).not.toHaveBeenCalled()
  })

  it('survives a failure to persist a misconception', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.3, understoodConcepts: [],
      misunderstoodConcepts: ['Some error'], missingPoints: [], feedback: 'f',
    })
    recordMisconception.mockRejectedValue(new Error('db down'))
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q2', response: 'x' },
    ])
    expect(result.score).toBeDefined()
  })
})
