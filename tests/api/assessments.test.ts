import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateQuestions = vi.fn()
const createAssessment = vi.fn()
const findAssessment = vi.fn()
const requireUser = vi.fn()
const gradeSubmission = vi.fn()
const findTopicWithConcepts = vi.fn()

vi.mock('@/lib/ai/assessment', () => ({ generateQuestions }))
vi.mock('@/lib/repositories/assessment', () => ({
  createAssessment,
  findAssessment,
}))
vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/assessment-service', () => ({ gradeSubmission }))
vi.mock('@/lib/repositories/concept', () => ({ findTopicWithConcepts }))

function post(body: unknown) {
  return new Request('http://t/api', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
})

describe('POST /api/assessments/generate', () => {
  it('creates an assessment from generated questions', async () => {
    findTopicWithConcepts.mockResolvedValue({
      id: 't1',
      title: 'Text Representation',
      courseTitle: 'Generative AI Foundations',
      concepts: [{ id: 'c1', name: 'Tokenization', definition: 'd' }],
    })
    generateQuestions.mockResolvedValue({
      questions: [
        {
          type: 'MCQ',
          prompt: 'q',
          options: ['a', 'b'],
          correctAnswer: 'a',
          explanation: 'e',
          conceptName: 'Tokenization',
          difficulty: 'BEGINNER',
        },
      ],
    })
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({ topicId: 't1' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('a1')
  })

  it('returns 404 for an unknown topic', async () => {
    findTopicWithConcepts.mockResolvedValue(null)
    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({ topicId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('rejects a missing topicId with 400', async () => {
    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({}))
    expect(res.status).toBe(400)
  })

  it('drops generated questions that name an unknown concept', async () => {
    findTopicWithConcepts.mockResolvedValue({
      id: 't1',
      title: 'T',
      courseTitle: 'C',
      concepts: [{ id: 'c1', name: 'Tokenization', definition: 'd' }],
    })
    generateQuestions.mockResolvedValue({
      questions: [
        { type: 'MCQ', prompt: 'keep', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Tokenization', difficulty: 'BEGINNER' },
        { type: 'MCQ', prompt: 'drop', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Nonexistent', difficulty: 'BEGINNER' },
      ],
    })
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/assessments/generate/route')
    await POST(post({ topicId: 't1' }))

    const { questions } = createAssessment.mock.calls[0][0]
    expect(questions).toHaveLength(1)
    expect(questions[0].prompt).toBe('keep')
  })
})

describe('GET /api/assessments/[id]', () => {
  it('returns the assessment', async () => {
    findAssessment.mockResolvedValue({ id: 'a1', questions: [] })
    const { GET } = await import('@/app/api/assessments/[id]/route')
    const res = await GET(new Request('http://t'), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 for an unknown id', async () => {
    findAssessment.mockResolvedValue(null)
    const { GET } = await import('@/app/api/assessments/[id]/route')
    const res = await GET(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/assessments/[id]/submit', () => {
  it('returns the graded result', async () => {
    gradeSubmission.mockResolvedValue({ score: 100, results: [] })
    const { POST } = await import('@/app/api/assessments/[id]/submit/route')
    const res = await POST(
      post({ responses: [{ questionId: 'q1', response: 'a' }] }),
      { params: Promise.resolve({ id: 'a1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.score).toBe(100)
  })

  it('rejects an empty responses array with 400', async () => {
    const { POST } = await import('@/app/api/assessments/[id]/submit/route')
    const res = await POST(post({ responses: [] }), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(res.status).toBe(400)
  })
})
