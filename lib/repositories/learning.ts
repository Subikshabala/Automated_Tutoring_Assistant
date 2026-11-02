import prisma from '@/lib/prisma'

/** Treat a concept as read after this long. */
const COMPLETION_SECONDS = 60

/** Ignore a single heartbeat claiming more than an hour — a stale tab. */
const MAX_SINGLE_VIEW_SECONDS = 3600

export async function startSession(userId: string, topicId: string) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: { module: { select: { courseId: true } } },
  })

  const existing = await prisma.learningSession.findFirst({
    where: { userId, topicId, endedAt: null },
  })
  if (existing) return existing

  // Only one session open at a time — close anything left dangling.
  await prisma.learningSession.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  })

  return prisma.learningSession.create({
    data: { userId, topicId, courseId: topic.module.courseId },
  })
}

export async function endSession(sessionId: string): Promise<void> {
  // updateMany rather than update: no throw when the id is unknown or
  // the session was already closed by a navigation race.
  await prisma.learningSession.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: new Date() },
  })
}

export async function recordConceptView(
  userId: string,
  conceptId: string,
  seconds: number,
): Promise<void> {
  const delta = Math.min(MAX_SINGLE_VIEW_SECONDS, Math.max(0, Math.round(seconds)))

  const existing = await prisma.learningProgress.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })

  const total = (existing?.timeSpentSec ?? 0) + delta

  await prisma.learningProgress.upsert({
    where: { userId_conceptId: { userId, conceptId } },
    create: {
      userId,
      conceptId,
      timeSpentSec: delta,
      completed: delta >= COMPLETION_SECONDS,
      lastViewedAt: new Date(),
    },
    update: {
      timeSpentSec: total,
      completed: total >= COMPLETION_SECONDS,
      lastViewedAt: new Date(),
    },
  })
}

export async function getConceptProgress(userId: string, conceptId: string) {
  return prisma.learningProgress.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })
}

export type ResumePoint = {
  topicId: string
  topicTitle: string
  courseSlug: string
  courseTitle: string
  lastSeenAt: Date
}

export async function getResumePoint(
  userId: string,
): Promise<ResumePoint | null> {
  const session = await prisma.learningSession.findFirst({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { slug: true, title: true } } } },
        },
      },
    },
  })

  if (!session?.topic) return null

  return {
    topicId: session.topic.id,
    topicTitle: session.topic.title,
    courseSlug: session.topic.module.course.slug,
    courseTitle: session.topic.module.course.title,
    lastSeenAt: session.startedAt,
  }
}

export async function countStartedConcepts(userId: string): Promise<number> {
  return prisma.learningProgress.count({ where: { userId } })
}
