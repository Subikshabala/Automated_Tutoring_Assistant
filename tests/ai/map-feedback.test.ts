import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/client', () => ({ generateStructured }))

const comparison = {
  matchedConcepts: ['Tokenization', 'Embeddings'],
  missingConcepts: ['Attention'],
  unrecognisedNodes: [],
  correctEdges: [{ from: 'Tokenization', to: 'Embeddings' }],
  missingEdges: [{ from: 'Embeddings', to: 'Attention' }],
  incorrectEdges: [],
  mistypedEdges: [],
  score: 65,
}

const feedback = {
  summary: 'You have the input pipeline but not the mechanism.',
  strengths: ['Correctly placed tokenization before embeddings.'],
  gaps: ['Attention is missing entirely.'],
  nextStep: 'Read the attention concept, then add it after embeddings.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateMapFeedback', () => {
  it('returns the validated feedback', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.nextStep).toContain('attention')
  })

  it('includes the missing concepts in the prompt', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    await generateMapFeedback('Generative AI', comparison)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('Attention')
  })

  it('includes the score in the prompt', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    await generateMapFeedback('Generative AI', comparison)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('65/100')
  })

  it('falls back to deterministic feedback when the model fails', async () => {
    generateStructured.mockRejectedValue(new Error('model down'))
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.summary).toContain('65')
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('names the missing concept in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('model down'))
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.gaps.join(' ')).toContain('Attention')
  })
})
