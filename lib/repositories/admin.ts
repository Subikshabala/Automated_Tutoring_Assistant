import prisma from '@/lib/prisma'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'
import type { Role } from '@/lib/schemas/auth'

export type LearnerRow = {
  id: string
  name: string
  email: string
  role: Role
  conceptsStarted: number
  conceptsMastered: number
  needsReview: number
  openMisconceptions: number
  lastActiveAt: Date | null
  joinedAt: Date
}

export async function listLearnerOverview(): Promise<LearnerRow[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      mastery: {
        select: { masteryScore: true, status: true, lastInteractionAt: true },
      },
      _count: { select: { materials: true } },
    },
  })

  const misconceptionCounts = await prisma.misconception.groupBy({
    by: ['userId'],
    where: { resolved: false },
    _count: true,
  })
  const misconceptionsByUser = new Map(
    misconceptionCounts.map((m) => [m.userId, m._count]),
  )

  const rows: LearnerRow[] = users.map((user) => {
    const lastActive = user.mastery.reduce<Date | null>(
      (latest, m) =>
        !latest || m.lastInteractionAt > latest ? m.lastInteractionAt : latest,
      null,
    )

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      conceptsStarted: user.mastery.length,
      conceptsMastered: user.mastery.filter(
        (m) => m.masteryScore >= MASTERED_THRESHOLD,
      ).length,
      needsReview: user.mastery.filter((m) => m.status === 'NEEDS_REVIEW').length,
      openMisconceptions: misconceptionsByUser.get(user.id) ?? 0,
      lastActiveAt: lastActive,
      joinedAt: user.createdAt,
    }
  })

  // Active learners first; never-active fall to the bottom by join date.
  return rows.sort((a, b) => {
    if (a.lastActiveAt && b.lastActiveAt) {
      return b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
    }
    if (a.lastActiveAt) return -1
    if (b.lastActiveAt) return 1
    return b.joinedAt.getTime() - a.joinedAt.getTime()
  })
}

export type PlatformStats = {
  courses: number
  learners: number
  assessmentsTaken: number
  materialsUploaded: number
  /** Concepts no learner has attempted — likely unreachable or unattractive. */
  untouchedConcepts: number
  openMisconceptions: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    courses,
    learners,
    assessmentsTaken,
    materialsUploaded,
    totalConcepts,
    touched,
    openMisconceptions,
  ] = await Promise.all([
    prisma.course.count({ where: { published: true } }),
    prisma.user.count(),
    prisma.assessment.count({ where: { submittedAt: { not: null } } }),
    prisma.material.count(),
    prisma.concept.count(),
    prisma.mastery.findMany({ select: { conceptId: true }, distinct: ['conceptId'] }),
    prisma.misconception.count({ where: { resolved: false } }),
  ])

  return {
    courses,
    learners,
    assessmentsTaken,
    materialsUploaded,
    untouchedConcepts: totalConcepts - touched.length,
    openMisconceptions,
  }
}
