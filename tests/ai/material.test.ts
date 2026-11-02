import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
const getChunks = vi.fn()
const findMaterial = vi.fn()
const saveSuggestions = vi.fn()
const embedText = vi.fn()

vi.mock('@/lib/ai/client', () => ({ generateStructured }))
vi.mock('@/lib/repositories/material', () => ({
  getChunks,
  findMaterial,
  saveSuggestions,
}))
vi.mock('@/lib/text/embed', () => ({
  embedText,
  cosineSimilarity: (a: number[], b: number[]) => {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    return dot
  },
}))

const chunks = [
  { id: 'c1', content: 'Tokenization splits text into subword units.', order: 0 },
  { id: 'c2', content: 'Embeddings encode semantic similarity as vectors.', order: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  findMaterial.mockResolvedValue({
    id: 'm1',
    filename: 'notes.txt',
    status: 'READY',
    suggestions: '',
  })
  getChunks.mockResolvedValue(chunks)
  // Default: embedText returns a dummy vector
  embedText.mockResolvedValue(new Array(384).fill(0))
})

describe('queryMaterial', () => {
  it('returns the grounded answer with its sources', async () => {
    generateStructured.mockResolvedValue({
      answer: 'It splits text into subword units.',
      foundInMaterial: true,
      quotedPassages: ['Tokenization splits text into subword units.'],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'What is tokenization?')
    expect(result.answer.foundInMaterial).toBe(true)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources[0].content).toContain('Tokenization')
  })

  it('sends the retrieved passages to the model', async () => {
    generateStructured.mockResolvedValue({
      answer: 'a',
      foundInMaterial: true,
      quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await queryMaterial('m1', 'What is tokenization?')
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('Tokenization splits text')
  })

  it('calls the model even when nothing matches strongly', async () => {
    generateStructured.mockResolvedValue({
      answer: 'The document does not cover that.',
      foundInMaterial: false,
      quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'quantum entanglement photons')
    expect(generateStructured).toHaveBeenCalled()
    expect(result.answer.foundInMaterial).toBe(false)
  }, 60_000)

  it('flags a weak match in the prompt', async () => {
    generateStructured.mockResolvedValue({
      answer: 'x', foundInMaterial: false, quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await queryMaterial('m1', 'quantum entanglement photons')
    expect(generateStructured.mock.calls[0][0].prompt).toContain(
      'no passage closely matched',
    )
  }, 60_000)

  it('answers a vague question instead of refusing', async () => {
    generateStructured.mockResolvedValue({
      answer: 'This document explains tokenization and embeddings.',
      foundInMaterial: true,
      quotedPassages: ['Tokenization splits text into subword units.'],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'what is this')
    expect(generateStructured).toHaveBeenCalled()
    expect(result.sources.length).toBeGreaterThan(0)
  }, 60_000)

  it('returns early only when the document has no chunks', async () => {
    getChunks.mockResolvedValue([])
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'anything')
    expect(generateStructured).not.toHaveBeenCalled()
    expect(result.answer.foundInMaterial).toBe(false)
  })

  it('throws NOT_FOUND for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { queryMaterial } = await import('@/lib/ai/material')
    await expect(queryMaterial('nope', 'q')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws MATERIAL_NOT_READY when the material is still processing', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1',
      filename: 'notes.txt',
      status: 'PROCESSING',
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await expect(queryMaterial('m1', 'q')).rejects.toMatchObject({
      code: 'MATERIAL_NOT_READY',
    })
  })

  it('uses a low temperature to stay close to the source', async () => {
    generateStructured.mockResolvedValue({
      answer: 'a',
      foundInMaterial: true,
      quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await queryMaterial('m1', 'tokenization')
    expect(generateStructured.mock.calls[0][0].temperature).toBeLessThanOrEqual(0.2)
  })
})

describe('getSuggestedQuestions', () => {
  it('returns cached suggestions without calling the model', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY',
      suggestions: '["Cached one?","Cached two?","Cached three?"]',
    })
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    const result = await getSuggestedQuestions('m1')
    expect(result).toHaveLength(3)
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('generates and persists when nothing is cached', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    generateStructured.mockResolvedValue({
      questions: ['What is tokenization?', 'Why subwords?', 'What is a vocab?'],
    })
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    expect(await getSuggestedQuestions('m1')).toHaveLength(3)
    expect(saveSuggestions).toHaveBeenCalled()
  })

  it('returns an empty array when generation fails', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    generateStructured.mockRejectedValue(new Error('model down'))
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('m1')).resolves.toEqual([])
  })

  it('returns an empty array for a document with no chunks', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    getChunks.mockResolvedValue([])
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('m1')).resolves.toEqual([])
  })

  it('throws NOT_FOUND for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
