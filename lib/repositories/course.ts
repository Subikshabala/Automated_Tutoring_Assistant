import prisma from '@/lib/prisma'
import type { CourseDetail, CourseSummary } from '@/lib/schemas/course'
import type { Difficulty } from '@/lib/schemas/common'

export type CourseListFilters = {
  category?: string
  difficulty?: Difficulty
}

export async function listCourses(
  filters: CourseListFilters,
): Promise<CourseSummary[]> {
  const rows = await prisma.course.findMany({
    where: {
      published: true,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    },
    orderBy: { title: 'asc' },
    include: {
      _count: { select: { modules: true, concepts: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    estimatedHours: row.estimatedHours,
    moduleCount: row._count.modules,
    conceptCount: row._count.concepts,
  }))
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.course.findMany({
    where: { published: true },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return rows.map((r) => r.category)
}

export async function findCourseBySlug(
  slug: string,
): Promise<CourseDetail | null> {
  const row = await prisma.course.findUnique({
    where: { slug },
    include: {
      _count: { select: { modules: true, concepts: true } },
      modules: {
        orderBy: { order: 'asc' },
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: { _count: { select: { concepts: true } } },
          },
        },
      },
    },
  })

  if (!row) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    estimatedHours: row.estimatedHours,
    moduleCount: row._count.modules,
    conceptCount: row._count.concepts,
    modules: row.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      topics: m.topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        order: t.order,
        conceptCount: t._count.concepts,
      })),
    })),
  }
}
