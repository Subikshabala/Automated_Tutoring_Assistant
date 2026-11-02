import prisma from '@/lib/prisma'
import { applyAttempt, masteryStatusFor, type MasteryState } from '@/lib/mastery'
import type { MasteryStatus } from '@/lib/schemas/common'

export type MasteryRecord = MasteryState & {
  conceptId: string
  status: MasteryStatus
  lastAssessmentAt: Date | null
}

export type MasteryWithConcept = MasteryRecord & {
  conceptName: string
}

export async function getMastery(
  userId: string,
  conceptId: string,
): Promise<MasteryRecord | null> {
  const row = await prisma.mastery.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })
  if (!row) return null

  return {
    conceptId: row.conceptId,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }
}

export async function recordAttempt(
  userId: string,
  conceptId: string,
  attemptScore: number,
): Promise<MasteryRecord> {
  const existing = await getMastery(userId, conceptId)

  const previous: MasteryState = existing ?? {
    masteryScore: 0,
    confidenceScore: 0,
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
  }

  const next = applyAttempt(previous, attemptScore)
  const status = masteryStatusFor(next.masteryScore, next.attemptCount)
  const now = new Date()

  const row = await prisma.mastery.upsert({
    where: { userId_conceptId: { userId, conceptId } },
    create: {
      userId,
      conceptId,
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
    update: {
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
  })

  return {
    conceptId: row.conceptId,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }
}

export async function listMasteryForCourse(
  userId: string,
  courseSlug: string,
): Promise<MasteryWithConcept[]> {
  const rows = await prisma.mastery.findMany({
    where: { userId, concept: { course: { slug: courseSlug } } },
    include: { concept: { select: { name: true } } },
    orderBy: { lastInteractionAt: 'desc' },
  })

  return rows.map((row) => ({
    conceptId: row.conceptId,
    conceptName: row.concept.name,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }))
}
