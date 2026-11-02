import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/client', () => ({ generateStructured }))

const input = {
  masteredCount: 2,
  startedCount: 5,
  totalCount: 28,
  topRecommendations: [
    { conceptName: 'Attention', action: 'LEARN' },
    { conceptName: 'Embeddings', action: 'PRACTISE' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateCoachSummary', () => {
  it('returns the validated summary', async () => {
    generateStructured.mockResolvedValue({
      headline: 'Two concepts mastered',
      body: 'Attention is next.',
    })
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary(input)
    expect(result.headline).toBe('Two concepts mastered')
  })

  it('includes the concept names in the prompt', async () => {
    generateStructured.mockResolvedValue({ headline: 'h', body: 'b' })
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    await generateCoachSummary(input)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('Attention')
  })

  it('falls back to deterministic text when the model fails', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary(input)
    expect(result.headline).toContain('2')
    expect(result.body).toContain('Attention')
  })

  it('handles an empty recommendation list in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary({
      ...input,
      topRecommendations: [],
    })
    expect(result.body.length).toBeGreaterThan(0)
  })

  it('handles a brand new learner in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary({
      masteredCount: 0,
      startedCount: 0,
      totalCount: 28,
      topRecommendations: [{ conceptName: 'Tokenization', action: 'LEARN' }],
    })
    expect(result.body).toContain('Tokenization')
  })
})
