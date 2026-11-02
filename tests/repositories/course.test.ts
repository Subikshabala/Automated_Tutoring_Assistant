import { describe, expect, it } from 'vitest'
import { findCourseBySlug, listCourses } from '@/lib/repositories/course'

describe('listCourses', () => {
  it('returns all seeded published courses', async () => {
    const courses = await listCourses({})
    expect(courses).toHaveLength(3)
  })

  it('includes derived module and concept counts', async () => {
    const courses = await listCourses({})
    const genAi = courses.find((c) => c.slug === 'generative-ai')
    expect(genAi?.moduleCount).toBe(2)
    expect(genAi?.conceptCount).toBe(11)
  })

  it('filters by category', async () => {
    const courses = await listCourses({ category: 'Security' })
    expect(courses.map((c) => c.slug)).toEqual(['cybersecurity-essentials'])
  })

  it('filters by difficulty', async () => {
    const courses = await listCourses({ difficulty: 'INTERMEDIATE' })
    expect(courses.map((c) => c.slug)).toEqual(['ai-agents'])
  })

  it('returns an empty array when nothing matches', async () => {
    const courses = await listCourses({ category: 'Underwater Basket Weaving' })
    expect(courses).toEqual([])
  })
})

describe('findCourseBySlug', () => {
  it('returns the course with nested modules and topics', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course).not.toBeNull()
    expect(course!.title).toBe('Generative AI Foundations')
    expect(course!.modules).toHaveLength(2)
    expect(course!.modules[0].topics).toHaveLength(2)
  })

  it('orders modules and topics by their order column', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course!.modules.map((m) => m.order)).toEqual([0, 1])
    expect(course!.modules[0].topics.map((t) => t.order)).toEqual([0, 1])
  })

  it('includes a concept count on each topic', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course!.modules[0].topics[0].conceptCount).toBe(3)
  })

  it('returns null for an unknown slug', async () => {
    await expect(findCourseBySlug('does-not-exist')).resolves.toBeNull()
  })
})
