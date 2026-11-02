import prisma from '@/lib/prisma'
import { readStringArray } from '@/lib/json-array'
import type { ConceptDto, ConceptGraph, ConceptRelationshipDto } from '@/lib/schemas/concept'

export type ConceptDetail = ConceptDto & {
  courseTitle: string
  courseSlug: string
  topicTitle: string | null
  moduleTitle: string | null
}

export async function getCourseGraph(
  courseSlug: string,
): Promise<ConceptGraph | null> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  })
  if (!course) return null

  const concepts = await prisma.concept.findMany({
    where: { courseId: course.id },
    orderBy: [{ moduleId: 'asc' }, { topicId: 'asc' }, { order: 'asc' }],
  })

  const conceptIds = concepts.map((c) => c.id)

  const relationships = await prisma.conceptRelationship.findMany({
    where: {
      fromId: { in: conceptIds },
      toId: { in: conceptIds },
    },
  })

  return {
    concepts: concepts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      moduleId: c.moduleId,
      topicId: c.topicId,
      name: c.name,
      definition: c.definition,
      difficulty: c.difficulty,
      objectives: readStringArray(c.objectives),
    })),
    relationships: relationships.map((r) => ({
      id: r.id,
      fromId: r.fromId,
      toId: r.toId,
      type: r.type,
      strength: r.strength,
    })),
  }
}

export async function findConceptById(
  id: string,
): Promise<ConceptDetail | null> {
  const row = await prisma.concept.findUnique({
    where: { id },
    include: {
      course: { select: { title: true, slug: true } },
      topic: { select: { title: true } },
      module: { select: { title: true } },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    courseId: row.courseId,
    moduleId: row.moduleId,
    topicId: row.topicId,
    name: row.name,
    definition: row.definition,
    difficulty: row.difficulty,
    objectives: readStringArray(row.objectives),
    courseTitle: row.course.title,
    courseSlug: row.course.slug,
    topicTitle: row.topic?.title ?? null,
    moduleTitle: row.module?.title ?? null,
  }
}

export type TopicWithConcepts = {
  id: string
  title: string
  description: string
  courseTitle: string
  courseSlug: string
  moduleTitle: string
  concepts: ConceptDto[]
  relationships: ConceptRelationshipDto[]
}

export async function findTopicWithConcepts(
  topicId: string,
): Promise<TopicWithConcepts | null> {
  const row = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      module: {
        select: {
          title: true,
          course: { select: { title: true, slug: true } },
        },
      },
      concepts: { orderBy: { order: 'asc' } },
    },
  })
  if (!row) return null

  const conceptIds = row.concepts.map((c) => c.id)

  const relationships = await prisma.conceptRelationship.findMany({
    where: {
      fromId: { in: conceptIds },
      toId: { in: conceptIds },
    },
  })

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    courseTitle: row.module.course.title,
    courseSlug: row.module.course.slug,
    moduleTitle: row.module.title,
    concepts: row.concepts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      moduleId: c.moduleId,
      topicId: c.topicId,
      name: c.name,
      definition: c.definition,
      difficulty: c.difficulty,
      objectives: readStringArray(c.objectives),
    })),
    relationships: relationships.map((r) => ({
      id: r.id,
      fromId: r.fromId,
      toId: r.toId,
      type: r.type,
      strength: r.strength,
    })),
  }
}
