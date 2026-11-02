import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/route'

function get(url: string) {
  return GET(new Request(url))
}

describe('GET /api/courses', () => {
  it('returns all courses in a data envelope', async () => {
    const res = await get('http://localhost/api/courses')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
  })

  it('filters by the category query param', async () => {
    const res = await get('http://localhost/api/courses?category=Security')
    const body = await res.json()
    expect(body.data.map((c: { slug: string }) => c.slug)).toEqual([
      'cybersecurity-essentials',
    ])
  })

  it('filters by the difficulty query param', async () => {
    const res = await get('http://localhost/api/courses?difficulty=INTERMEDIATE')
    const body = await res.json()
    expect(body.data.map((c: { slug: string }) => c.slug)).toEqual(['ai-agents'])
  })

  it('rejects an invalid difficulty with 400', async () => {
    const res = await get('http://localhost/api/courses?difficulty=EXPERT')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
