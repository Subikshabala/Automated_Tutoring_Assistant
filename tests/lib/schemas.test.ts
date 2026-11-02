import { describe, expect, it } from 'vitest'
import { difficultySchema, paginationSchema } from '@/lib/schemas/common'
import { courseSummarySchema } from '@/lib/schemas/course'
import { conceptSchema, relationshipTypeSchema } from '@/lib/schemas/concept'

describe('paginationSchema', () => {
  it('applies defaults when fields are absent', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 })
  })

  it('coerces numeric strings from query params', () => {
    expect(paginationSchema.parse({ page: '3' }).page).toBe(3)
  })

  it('rejects a page below 1', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('caps perPage at 100', () => {
    expect(paginationSchema.safeParse({ perPage: 101 }).success).toBe(false)
  })
})

describe('difficultySchema', () => {
  it('accepts a known level', () => {
    expect(difficultySchema.parse('BEGINNER')).toBe('BEGINNER')
  })

  it('rejects an unknown level', () => {
    expect(difficultySchema.safeParse('EXPERT').success).toBe(false)
  })
})

describe('courseSummarySchema', () => {
  it('accepts a well formed course', () => {
    const parsed = courseSummarySchema.parse({
      id: 'c1',
      slug: 'generative-ai',
      title: 'Generative AI',
      description: 'Foundations of generative models.',
      category: 'AI',
      difficulty: 'BEGINNER',
      estimatedHours: 6,
      moduleCount: 3,
      conceptCount: 24,
    })
    expect(parsed.slug).toBe('generative-ai')
  })

  it('rejects a slug with spaces', () => {
    const result = courseSummarySchema.safeParse({
      id: 'c1',
      slug: 'not a slug',
      title: 'T',
      description: 'D',
      category: 'AI',
      difficulty: 'BEGINNER',
      estimatedHours: 1,
      moduleCount: 0,
      conceptCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('conceptSchema', () => {
  it('accepts a concept with objectives as a real array', () => {
    const parsed = conceptSchema.parse({
      id: 'x1',
      courseId: 'c1',
      name: 'Tokenization',
      definition: 'Splitting text into tokens.',
      difficulty: 'BEGINNER',
      objectives: ['Define a token'],
    })
    expect(parsed.objectives).toEqual(['Define a token'])
  })

  it('defaults objectives to an empty array', () => {
    const parsed = conceptSchema.parse({
      id: 'x1',
      courseId: 'c1',
      name: 'Tokenization',
      definition: 'Splitting text into tokens.',
      difficulty: 'BEGINNER',
    })
    expect(parsed.objectives).toEqual([])
  })
})

describe('relationshipTypeSchema', () => {
  it('accepts all four relationship types', () => {
    for (const t of ['PREREQUISITE_OF', 'RELATED_TO', 'PART_OF', 'LEADS_TO']) {
      expect(relationshipTypeSchema.parse(t)).toBe(t)
    }
  })
})
