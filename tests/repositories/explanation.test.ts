import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  findCachedExplanation,
  saveExplanation,
} from '@/lib/repositories/explanation'

async function firstConceptId() {
  const concept = await prisma.concept.findFirstOrThrow({
    where: { name: 'Tokenization' },
  })
  return concept.id
}

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens.',
  whyItMatters: 'Token count drives cost.',
  example: '"tokenization" splits into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why not whole words?',
}

// Clean both sides. Another suite may leave a cached explanation behind,
// and afterEach alone cannot protect the first assertion in this file.
beforeEach(async () => {
  await prisma.conceptExplanation.deleteMany({
    where: { conceptId: await firstConceptId() },
  })
})

afterEach(async () => {
  await prisma.conceptExplanation.deleteMany({
    where: { conceptId: await firstConceptId() },
  })
})

describe('findCachedExplanation', () => {
  it('returns null when nothing is cached', async () => {
    await expect(
      findCachedExplanation(await firstConceptId()),
    ).resolves.toBeNull()
  })
})

describe('saveExplanation', () => {
  it('persists an explanation that can be read back', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.title).toBe('Tokenization')
  })

  it('round-trips keyPoints as a real array', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.keyPoints).toEqual([
      'Tokens are subwords',
      'Cost scales with tokens',
    ])
  })

  it('overwrites an existing cache entry rather than erroring', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    await saveExplanation(
      conceptId,
      { ...explanation, title: 'Updated' },
      'gemini-2.0-flash',
    )
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.title).toBe('Updated')
  })
})
