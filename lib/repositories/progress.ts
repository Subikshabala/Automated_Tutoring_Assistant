import prisma from '@/lib/prisma'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'
import type { CourseProgress } from '@/lib/schemas/recommendation'

export async function getAllCourseProgress(
  userId: string,
): Promise<CourseProgress[]> {
  const courses = await prisma.course.findMany({
    where: { published: true },
    orderBy: { title: 'asc' },
    select: {
      slug: true,
      title: true,
      _count: { select: { concepts: true } },
    },
  })

  const masteryRows = await prisma.mastery.findMany({
    where: { userId },
    include: {
      concept: { select: { course: { select: { slug: true } } } },
    },
  })

  const bySlug = new Map<
    string,
    { scores: number[]; mastered: number; lastActivity: Date | null }
  >()

  for (const row of masteryRows) {
    const slug = row.concept.course.slug
    const bucket = bySlug.get(slug) ?? {
      scores: [],
      mastered: 0,
      lastActivity: null,
    }

    bucket.scores.push(row.masteryScore)
    if (row.masteryScore >= MASTERED_THRESHOLD) bucket.mastered += 1
    if (
      !bucket.lastActivity ||
      row.lastInteractionAt > bucket.lastActivity
    ) {
      bucket.lastActivity = row.lastInteractionAt
    }

    bySlug.set(slug, bucket)
  }

  return courses.map((course) => {
    const bucket = bySlug.get(course.slug)
    const scores = bucket?.scores ?? []
    const average =
      scores.length === 0
        ? 0
        : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    return {
      courseSlug: course.slug,
      courseTitle: course.title,
      totalConcepts: course._count.concepts,
      startedConcepts: scores.length,
      masteredConcepts: bucket?.mastered ?? 0,
      averageMastery: average,
      lastActivityAt: bucket?.lastActivity?.toISOString() ?? null,
    }
  })
}
