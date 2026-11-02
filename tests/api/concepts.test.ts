import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/[slug]/concepts/route'

function get(slug: string) {
  return GET(new Request(`http://localhost/api/courses/${slug}/concepts`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /api/courses/[slug]/concepts', () => {
  it('returns the concept graph for a known course', async () => {
    const res = await get('generative-ai')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.concepts).toHaveLength(11)
    expect(body.data.relationships).toHaveLength(11)
  })

  it('returns objectives as arrays, not json strings', async () => {
    const res = await get('generative-ai')
    const body = await res.json()
    expect(Array.isArray(body.data.concepts[0].objectives)).toBe(true)
  })

  it('returns 404 for an unknown course', async () => {
    const res = await get('nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
