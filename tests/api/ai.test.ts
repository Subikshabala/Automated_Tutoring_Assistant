import { beforeEach, describe, expect, it, vi } from 'vitest'

const explainConcept = vi.fn()
const answerQuestion = vi.fn()

vi.mock('@/lib/ai/tutor', () => ({ explainConcept, answerQuestion }))

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/ai/explain', () => {
  it('returns the explanation for a valid request', async () => {
    explainConcept.mockResolvedValue({
      explanation: { title: 'Tokenization' },
      cached: false,
    })
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', { conceptId: 'x1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.explanation.title).toBe('Tokenization')
    expect(body.data.cached).toBe(false)
  })

  it('rejects a missing conceptId with 400', async () => {
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', {}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('surfaces an AI_UNAVAILABLE error as 503', async () => {
    const { ApiError } = await import('@/lib/api')
    explainConcept.mockRejectedValue(
      new ApiError('AI_UNAVAILABLE', 'down', 503),
    )
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', { conceptId: 'x1' }))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/ai/ask', () => {
  it('returns the tutor answer for a valid request', async () => {
    answerQuestion.mockResolvedValue({
      answer: 'Because subwords generalise.',
      relatedConcepts: [],
      followUpQuestion: null,
    })
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', { conceptId: 'x1', question: 'Why?' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.answer).toContain('subwords')
  })

  it('rejects an empty question with 400', async () => {
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', { conceptId: 'x1', question: '' }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects a question over 1000 characters', async () => {
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', {
        conceptId: 'x1',
        question: 'a'.repeat(1001),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts an optional history array', async () => {
    answerQuestion.mockResolvedValue({
      answer: 'ok',
      relatedConcepts: [],
      followUpQuestion: null,
    })
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', {
        conceptId: 'x1',
        question: 'Why?',
        history: [{ role: 'user', content: 'earlier' }],
      }),
    )
    expect(res.status).toBe(200)
    expect(answerQuestion).toHaveBeenCalledWith('x1', 'Why?', [
      { role: 'user', content: 'earlier' },
    ])
  })
})
