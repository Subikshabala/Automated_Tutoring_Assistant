import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const createMaterial = vi.fn()
const storeChunks = vi.fn()
const markFailed = vi.fn()
const listMaterials = vi.fn()
const findMaterial = vi.fn()
const deleteMaterial = vi.fn()
const extractText = vi.fn()
const queryMaterial = vi.fn()

vi.mock('@/lib/auth/guard', () => ({ requireUser, requireAdmin: vi.fn() }))
vi.mock('@/lib/repositories/material', () => ({
  createMaterial,
  storeChunks,
  markFailed,
  listMaterials,
  findMaterial,
  deleteMaterial,
}))
vi.mock('@/lib/text/extract', async () => {
  const actual = await vi.importActual<typeof import('@/lib/text/extract')>(
    '@/lib/text/extract',
  )
  return { ...actual, extractText }
})
vi.mock('@/lib/ai/material', () => ({ queryMaterial }))

function upload(file: File) {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://t/api/materials', { method: 'POST', body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'u1', role: 'USER' })
  createMaterial.mockResolvedValue({ id: 'm1', filename: 'notes.txt' })
})

describe('POST /api/materials', () => {
  it('accepts a text file and stores its chunks', async () => {
    extractText.mockResolvedValue('some extracted text')
    findMaterial.mockResolvedValue({ id: 'm1', status: 'READY', chunkCount: 1 })
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['hello'], 'notes.txt', { type: 'text/plain' })),
    )
    expect(res.status).toBe(201)
    expect(storeChunks).toHaveBeenCalled()
  })

  it('rejects an unsupported mime type with 400', async () => {
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['x'], 'image.png', { type: 'image/png' })),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('UNSUPPORTED_TYPE')
  })

  it('rejects a request with no file', async () => {
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      new Request('http://t/api/materials', {
        method: 'POST',
        body: new FormData(),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('marks the material FAILED when extraction throws', async () => {
    const { ApiError } = await import('@/lib/api')
    extractText.mockRejectedValue(
      new ApiError('EXTRACTION_FAILED', 'Scanned images only', 422),
    )
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['x'], 'scan.pdf', { type: 'application/pdf' })),
    )
    expect(res.status).toBe(422)
    expect(markFailed).toHaveBeenCalledWith('m1', 'Scanned images only')
  })
})

describe('GET /api/materials', () => {
  it('returns the learner materials', async () => {
    listMaterials.mockResolvedValue([{ id: 'm1', filename: 'notes.txt' }])
    const { GET } = await import('@/app/api/materials/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

describe('DELETE /api/materials/[id]', () => {
  it('deletes an existing material', async () => {
    findMaterial.mockResolvedValue({ id: 'm1' })
    const { DELETE } = await import('@/app/api/materials/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    expect(deleteMaterial).toHaveBeenCalledWith('m1')
  })

  it('returns 404 for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/materials/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/materials/[id]/query', () => {
  it('returns the grounded answer', async () => {
    queryMaterial.mockResolvedValue({
      answer: { answer: 'yes', foundInMaterial: true, quotedPassages: [] },
      sources: [],
    })
    const { POST } = await import('@/app/api/materials/[id]/query/route')
    const res = await POST(
      new Request('http://t', {
        method: 'POST',
        body: JSON.stringify({ question: 'What is X?' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.answer.foundInMaterial).toBe(true)
  })

  it('rejects an empty question with 400', async () => {
    const { POST } = await import('@/app/api/materials/[id]/query/route')
    const res = await POST(
      new Request('http://t', {
        method: 'POST',
        body: JSON.stringify({ question: '' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )
    expect(res.status).toBe(400)
  })
})
