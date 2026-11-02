import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const saveStudentMap = vi.fn()
const findStudentMap = vi.fn()
const listStudentMaps = vi.fn()
const deleteStudentMap = vi.fn()
const getCourseGraph = vi.fn()
const findCourseBySlug = vi.fn()
const generateMapFeedback = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/repositories/student-map', () => ({
  saveStudentMap,
  findStudentMap,
  listStudentMaps,
  deleteStudentMap,
}))
vi.mock('@/lib/repositories/concept', () => ({ getCourseGraph }))
vi.mock('@/lib/repositories/course', () => ({ findCourseBySlug }))
vi.mock('@/lib/ai/map-feedback', () => ({ generateMapFeedback }))

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) })
}

const validBody = {
  courseSlug: 'generative-ai',
  title: 'My map',
  nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
  edges: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
})

describe('POST /api/concept-maps', () => {
  it('saves a valid map', async () => {
    saveStudentMap.mockResolvedValue({ id: 'm1', title: 'My map' })
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(post('http://t/api/concept-maps', validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('m1')
  })

  it('rejects a map with no nodes', async () => {
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(
      post('http://t/api/concept-maps', { ...validBody, nodes: [] }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects an edge pointing at a node not in the map', async () => {
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(
      post('http://t/api/concept-maps', {
        ...validBody,
        edges: [{ id: 'e1', fromId: 'n1', toId: 'ghost', type: 'RELATED_TO' }],
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('GET /api/concept-maps', () => {
  it('returns the learner maps for a course', async () => {
    listStudentMaps.mockResolvedValue([{ id: 'm1' }])
    const { GET } = await import('@/app/api/concept-maps/route')
    const res = await GET(
      new Request('http://t/api/concept-maps?courseSlug=generative-ai'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('rejects a request with no courseSlug', async () => {
    const { GET } = await import('@/app/api/concept-maps/route')
    const res = await GET(new Request('http://t/api/concept-maps'))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/concept-maps/[id]', () => {
  it('deletes an existing map', async () => {
    findStudentMap.mockResolvedValue({ id: 'm1' })
    const { DELETE } = await import('@/app/api/concept-maps/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    expect(deleteStudentMap).toHaveBeenCalledWith('m1')
  })

  it('returns 404 for an unknown map', async () => {
    findStudentMap.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/concept-maps/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/concept-maps/[id]/compare', () => {
  it('returns the comparison and feedback', async () => {
    findStudentMap.mockResolvedValue({
      id: 'm1',
      courseSlug: 'generative-ai',
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    findCourseBySlug.mockResolvedValue({ title: 'Generative AI Foundations' })
    getCourseGraph.mockResolvedValue({
      concepts: [
        {
          id: 'c1',
          courseId: 'c',
          name: 'Tokenization',
          definition: 'd',
          difficulty: 'BEGINNER',
          objectives: [],
        },
      ],
      relationships: [],
    })
    generateMapFeedback.mockResolvedValue({
      summary: 's',
      strengths: [],
      gaps: [],
      nextStep: 'n',
    })

    const { POST } = await import('@/app/api/concept-maps/[id]/compare/route')
    const res = await POST(new Request('http://t', { method: 'POST' }), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.comparison.score).toBe(100)
    expect(body.data.feedback.nextStep).toBe('n')
  })

  it('returns 404 for an unknown map', async () => {
    findStudentMap.mockResolvedValue(null)
    const { POST } = await import('@/app/api/concept-maps/[id]/compare/route')
    const res = await POST(new Request('http://t', { method: 'POST' }), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})
