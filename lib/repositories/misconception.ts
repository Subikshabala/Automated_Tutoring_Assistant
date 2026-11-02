import prisma from '@/lib/prisma'

export type MisconceptionRecord = {
  id: string
  conceptId: string
  conceptName: string
  courseSlug: string
  description: string
  evidence: string
  detectedAt: Date
}

export type RecordInput = {
  userId: string
  conceptId: string
  description: string
  evidence: string
}

/** Collapse wording differences so the same error is not stored twice. */
function normalise(description: string): string {
  return description.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
}

export async function recordMisconception(input: RecordInput): Promise<void> {
  const existing = await prisma.misconception.findMany({
    where: { userId: input.userId, conceptId: input.conceptId },
  })

  const match = existing.find(
    (m) => normalise(m.description) === normalise(input.description),
  )

  if (match) {
    // Same error again. Append the evidence and reopen if it had been
    // marked resolved — recurrence means it was not.
    await prisma.misconception.update({
      where: { id: match.id },
      data: {
        evidence: `${match.evidence}\n---\n${input.evidence}`,
        resolved: false,
        detectedAt: new Date(),
      },
    })
    return
  }

  await prisma.misconception.create({
    data: {
      userId: input.userId,
      conceptId: input.conceptId,
      description: input.description,
      evidence: input.evidence,
    },
  })
}

export async function listOpenMisconceptions(
  userId: string,
): Promise<MisconceptionRecord[]> {
  const rows = await prisma.misconception.findMany({
    where: { userId, resolved: false },
    orderBy: { detectedAt: 'desc' },
    include: {
      concept: {
        select: { id: true, name: true, course: { select: { slug: true } } },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    conceptId: row.conceptId,
    conceptName: row.concept.name,
    courseSlug: row.concept.course.slug,
    description: row.description,
    evidence: row.evidence,
    detectedAt: row.detectedAt,
  }))
}

export async function resolveMisconception(id: string): Promise<void> {
  await prisma.misconception.updateMany({
    where: { id, resolved: false },
    data: { resolved: true },
  })
}

export async function resolveMisconceptionsForConcept(
  userId: string,
  conceptId: string,
): Promise<void> {
  await prisma.misconception.updateMany({
    where: { userId, conceptId, resolved: false },
    data: { resolved: true },
  })
}

export async function countOpenMisconceptions(userId: string): Promise<number> {
  return prisma.misconception.count({ where: { userId, resolved: false } })
}
