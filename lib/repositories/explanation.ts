import prisma from '@/lib/prisma'
import { readStringArray, writeStringArray } from '@/lib/json-array'
import type { ConceptExplanation } from '@/lib/schemas/ai'

export async function findCachedExplanation(
  conceptId: string,
): Promise<ConceptExplanation | null> {
  const row = await prisma.conceptExplanation.findUnique({
    where: { conceptId },
  })
  if (!row) return null

  return {
    title: row.title,
    simpleExplanation: row.simpleExplanation,
    whyItMatters: row.whyItMatters,
    example: row.example,
    keyPoints: readStringArray(row.keyPoints),
    checkQuestion: row.checkQuestion,
  }
}

export async function saveExplanation(
  conceptId: string,
  explanation: ConceptExplanation,
  model: string,
): Promise<void> {
  const data = {
    title: explanation.title,
    simpleExplanation: explanation.simpleExplanation,
    whyItMatters: explanation.whyItMatters,
    example: explanation.example,
    keyPoints: writeStringArray(explanation.keyPoints),
    checkQuestion: explanation.checkQuestion,
    model,
  }

  await prisma.conceptExplanation.upsert({
    where: { conceptId },
    create: { conceptId, ...data },
    update: data,
  })
}
