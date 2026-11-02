import { describe, expect, it } from 'vitest'
import { findConceptById, getCourseGraph } from '@/lib/repositories/concept'

describe('getCourseGraph', () => {
  it('returns every concept in the course', async () => {
    const graph = await getCourseGraph('generative-ai')
    expect(graph).not.toBeNull()
    expect(graph!.concepts).toHaveLength(11)
  })

  it('returns every relationship in the course', async () => {
    const graph = await getCourseGraph('generative-ai')
    expect(graph!.relationships).toHaveLength(11)
  })

  it('parses objectives into a real array', async () => {
    const graph = await getCourseGraph('generative-ai')
    const tokenization = graph!.concepts.find((c) => c.name === 'Tokenization')
    expect(tokenization!.objectives).toHaveLength(3)
    expect(tokenization!.objectives[0]).toContain('subwords')
  })

  it('only returns relationships whose endpoints are both in this course', async () => {
    const graph = await getCourseGraph('generative-ai')
    const ids = new Set(graph!.concepts.map((c) => c.id))
    for (const rel of graph!.relationships) {
      expect(ids.has(rel.fromId)).toBe(true)
      expect(ids.has(rel.toId)).toBe(true)
    }
  })

  it('returns null for an unknown course slug', async () => {
    await expect(getCourseGraph('nope')).resolves.toBeNull()
  })
})

describe('findConceptById', () => {
  it('returns a concept with its course and topic titles', async () => {
    const graph = await getCourseGraph('generative-ai')
    const target = graph!.concepts.find((c) => c.name === 'Attention')!
    const detail = await findConceptById(target.id)
    expect(detail!.name).toBe('Attention')
    expect(detail!.courseTitle).toBe('Generative AI Foundations')
    expect(detail!.topicTitle).toBe('Generation Mechanics')
  })

  it('returns null for an unknown id', async () => {
    await expect(findConceptById('nope')).resolves.toBeNull()
  })
})
