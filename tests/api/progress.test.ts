import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const getAllCourseProgress = vi.fn()
const listMasteryForCourse = vi.fn()
const getCourseGraph = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/repositories/progress', () => ({ getAllCourseProgress }))
vi.mock('@/lib/repositories/mastery', () => ({ listMasteryForCourse }))
vi.mock('@/lib/repositories/concept', () => ({ getCourseGraph }))

const graph = {
  concepts: [
    {
      id: 'c1',
      courseId: 'course1',
      topicId: 't1',
      name: 'Tokenization',
      definition: 'd',
      difficulty: 'BEGINNER',
      objectives: [],
    },
  ],
  relationships: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
})

describe('GET /api/progress', () => {
  it('returns per-course progress', async () => {
    getAllCourseProgress.mockResolvedValue([
      { courseSlug: 'generative-ai', totalConcepts: 11 },
    ])
    const { GET } = await import('@/app/api/progress/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

describe('GET /api/recommendations', () => {
  it('returns recommendations for a course', async () => {
    getCourseGraph.mockResolvedValue(graph)
    listMasteryForCourse.mockResolvedValue([])
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request('http://t/api/recommendations?courseSlug=generative-ai'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].conceptName).toBe('Tokenization')
  })

  it('rejects a request with no courseSlug', async () => {
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(new Request('http://t/api/recommendations'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown course', async () => {
    getCourseGraph.mockResolvedValue(null)
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request('http://t/api/recommendations?courseSlug=nope'),
    )
    expect(res.status).toBe(404)
  })

  it('respects the limit query param', async () => {
    getCourseGraph.mockResolvedValue({
      concepts: Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        courseId: 'course1',
        topicId: 't1',
        name: `Concept ${i}`,
        definition: 'd',
        difficulty: 'BEGINNER',
        objectives: [],
      })),
      relationships: [],
    })
    listMasteryForCourse.mockResolvedValue([])
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request(
        'http://t/api/recommendations?courseSlug=generative-ai&limit=2',
      ),
    )
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })
})
