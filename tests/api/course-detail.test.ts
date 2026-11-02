import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/[slug]/route'

function get(slug: string) {
  return GET(new Request(`http://localhost/api/courses/${slug}`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /api/courses/[slug]', () => {
  it('returns the course detail for a known slug', async () => {
    const res = await get('generative-ai')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Generative AI Foundations')
    expect(body.data.modules).toHaveLength(2)
  })

  it('nests topics inside modules', async () => {
    const res = await get('generative-ai')
    const body = await res.json()
    expect(body.data.modules[0].topics[0].title).toBe('Text Representation')
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await get('nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
