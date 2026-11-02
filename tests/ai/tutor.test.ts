import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
const findCachedExplanation = vi.fn()
const saveExplanation = vi.fn()
const findConceptById = vi.fn()

vi.mock('@/lib/ai/client', () => ({ generateStructured }))
vi.mock('@/lib/ai/providers', () => ({
  resolveProvider: () => ({ name: 'groq', model: 'openai/gpt-oss-20b' }),
}))
vi.mock('@/lib/repositories/explanation', () => ({
  findCachedExplanation,
  saveExplanation,
}))
vi.mock('@/lib/repositories/concept', () => ({ findConceptById }))

const concept = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens.',
  difficulty: 'BEGINNER' as const,
  objectives: ['Explain subwords'],
  courseTitle: 'Generative AI Foundations',
  courseSlug: 'generative-ai',
  topicTitle: 'Text Representation',
  moduleTitle: 'How Language Models Work',
}

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text.',
  whyItMatters: 'Cost.',
  example: 'An example.',
  keyPoints: ['a', 'b'],
  checkQuestion: 'Why?',
}

beforeEach(() => {
  vi.clearAllMocks()
  findConceptById.mockResolvedValue(concept)
})

describe('explainConcept', () => {
  it('returns the cached explanation without calling the model', async () => {
    findCachedExplanation.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    const result = await explainConcept('x1')
    expect(result.explanation.title).toBe('Tokenization')
    expect(result.cached).toBe(true)
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('calls the model when nothing is cached', async () => {
    findCachedExplanation.mockResolvedValue(null)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    const result = await explainConcept('x1')
    expect(generateStructured).toHaveBeenCalledOnce()
    expect(result.cached).toBe(false)
  })

  it('persists a freshly generated explanation', async () => {
    findCachedExplanation.mockResolvedValue(null)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await explainConcept('x1')
    expect(saveExplanation).toHaveBeenCalledWith(
      'x1',
      explanation,
      expect.any(String),
    )
  })

  it('throws NOT_FOUND for an unknown concept', async () => {
    findConceptById.mockResolvedValue(null)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await expect(explainConcept('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('regenerates when forceRefresh is set, even with a cache hit', async () => {
    findCachedExplanation.mockResolvedValue(explanation)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await explainConcept('x1', { forceRefresh: true })
    expect(generateStructured).toHaveBeenCalledOnce()
  })
})

describe('answerQuestion', () => {
  const answer = {
    answer: 'Because subwords generalise.',
    relatedConcepts: ['Embeddings'],
    followUpQuestion: 'What about unseen words?',
  }

  it('returns the validated model answer', async () => {
    generateStructured.mockResolvedValue(answer)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    const result = await answerQuestion('x1', 'Why subwords?', [])
    expect(result.answer).toContain('subwords')
  })

  it('passes prior turns into the prompt', async () => {
    generateStructured.mockResolvedValue(answer)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    await answerQuestion('x1', 'And then?', [
      { role: 'user', content: 'What is a token?' },
    ])
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('What is a token?')
  })

  it('throws NOT_FOUND for an unknown concept', async () => {
    findConceptById.mockResolvedValue(null)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    await expect(answerQuestion('nope', 'q', [])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
