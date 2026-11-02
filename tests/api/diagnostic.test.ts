import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const getCourseGraph = vi.fn()
const findCourseBySlug = vi.fn()
const generateDiagnostic = vi.fn()
const createAssessment = vi.fn()
const markDiagnosticTaken = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/repositories/concept', () => ({ getCourseGraph }))
vi.mock('@/lib/repositories/course', () => ({ findCourseBySlug }))
vi.mock('@/lib/ai/assessment', () => ({ generateDiagnostic }))
vi.mock('@/lib/repositories/assessment', () => ({ createAssessment }))
vi.mock('@/lib/repositories/user', () => ({ markDiagnosticTaken }))

function post(body: unknown) {
  return new Request('http://t/api/diagnostic', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function patch(body: unknown) {
  return new Request('http://t/api/diagnostic', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

const mockCourse = {
  id: 'course1',
  slug: 'generative-ai',
  title: 'Generative AI',
  description: 'd',
  category: 'AI',
  difficulty: 'BEGINNER' as const,
  estimatedHours: 10,
  moduleCount: 1,
  conceptCount: 3,
  modules: [],
}

const mockGraph = {
  concepts: [
    { id: 'c1', courseId: 'course1', name: 'Tokenization', definition: 'd1', difficulty: 'BEGINNER' as const, objectives: [], topicId: 't1' },
    { id: 'c2', courseId: 'course1', name: 'Embeddings', definition: 'd2', difficulty: 'INTERMEDIATE' as const, objectives: [], topicId: 't1' },
    { id: 'c3', courseId: 'course1', name: 'Attention', definition: 'd3', difficulty: 'ADVANCED' as const, objectives: [], topicId: 't1' },
  ],
  relationships: [
    { id: 'r1', fromId: 'c1', toId: 'c2', type: 'PREREQUISITE_OF' as const, strength: 1 },
    { id: 'r2', fromId: 'c2', toId: 'c3', type: 'PREREQUISITE_OF' as const, strength: 1 },
  ],
}

const mockQuiz = {
  questions: [
    { type: 'MCQ' as const, prompt: 'q1', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e1', conceptName: 'Tokenization', difficulty: 'BEGINNER' as const },
    { type: 'SHORT_ANSWER' as const, prompt: 'q2', options: [], correctAnswer: 'ans', explanation: 'e2', conceptName: 'Embeddings', difficulty: 'INTERMEDIATE' as const },
    { type: 'SHORT_ANSWER' as const, prompt: 'q3', options: [], correctAnswer: 'ans', explanation: 'e3', conceptName: 'Attention', difficulty: 'ADVANCED' as const },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
})

describe('POST /api/diagnostic', () => {
  it('creates a diagnostic assessment', async () => {
    findCourseBySlug.mockResolvedValue(mockCourse)
    getCourseGraph.mockResolvedValue(mockGraph)
    generateDiagnostic.mockResolvedValue(mockQuiz)
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/diagnostic/route')
    const res = await POST(post({ courseSlug: 'generative-ai' }))
    expect(res.status).toBe(201)
    expect(createAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'diagnostic' }),
    )
    expect(markDiagnosticTaken).toHaveBeenCalledWith('u1', 'generative-ai')
  })

  it('returns 404 for an unknown course', async () => {
    findCourseBySlug.mockResolvedValue(null)
    getCourseGraph.mockResolvedValue(null)

    const { POST } = await import('@/app/api/diagnostic/route')
    const res = await POST(post({ courseSlug: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('drops questions naming unknown concepts', async () => {
    findCourseBySlug.mockResolvedValue(mockCourse)
    getCourseGraph.mockResolvedValue(mockGraph)
    generateDiagnostic.mockResolvedValue({
      questions: [
        ...mockQuiz.questions,
        { type: 'MCQ' as const, prompt: 'q-bad', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Nonexistent', difficulty: 'BEGINNER' as const },
      ],
    })
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/diagnostic/route')
    await POST(post({ courseSlug: 'generative-ai' }))

    const { questions } = createAssessment.mock.calls[0][0]
    expect(questions).toHaveLength(3)
    expect(questions.every((q: { prompt: string }) => q.prompt !== 'q-bad')).toBe(true)
  })

  it('returns 502 when all generated questions are invalid', async () => {
    findCourseBySlug.mockResolvedValue(mockCourse)
    getCourseGraph.mockResolvedValue(mockGraph)
    generateDiagnostic.mockResolvedValue({
      questions: [
        { type: 'MCQ' as const, prompt: 'q-bad', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Nonexistent', difficulty: 'BEGINNER' as const },
      ],
    })

    const { POST } = await import('@/app/api/diagnostic/route')
    const res = await POST(post({ courseSlug: 'generative-ai' }))
    expect(res.status).toBe(502)
  })

  it('returns 401 when unauthenticated', async () => {
    requireUser.mockRejectedValue(
      Object.assign(new Error('Sign in to continue'), { code: 'UNAUTHORIZED', status: 401, name: 'ApiError' }),
    )
    // ApiError is caught by handle() — we need to import the real ApiError
    const { ApiError } = await import('@/lib/api')
    requireUser.mockRejectedValue(new ApiError('UNAUTHORIZED', 'Sign in to continue', 401))

    const { POST } = await import('@/app/api/diagnostic/route')
    const res = await POST(post({ courseSlug: 'generative-ai' }))
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/diagnostic', () => {
  it('marks the diagnostic as skipped', async () => {
    const { PATCH } = await import('@/app/api/diagnostic/route')
    const res = await PATCH(patch({ courseSlug: 'generative-ai' }))
    expect(res.status).toBe(200)
    expect(markDiagnosticTaken).toHaveBeenCalledWith('u1', 'generative-ai')
    const body = await res.json()
    expect(body.data.skipped).toBe(true)
  })
})
