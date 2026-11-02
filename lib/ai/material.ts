import { ApiError } from '@/lib/api'
import { generateStructured } from '@/lib/ai/client'
import { groundedPrompt, suggestionsPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'
import {
  groundedAnswerSchema,
  suggestedQuestionsSchema,
  type GroundedAnswer,
} from '@/lib/schemas/material'
import { findMaterial, getChunks, saveSuggestions } from '@/lib/repositories/material'
import { hybridRank, type RankedChunk } from '@/lib/text/retrieve'

const TOP_K = 4

export async function queryMaterial(
  materialId: string,
  question: string,
): Promise<{ answer: GroundedAnswer; sources: RankedChunk[] }> {
  const material = await findMaterial(materialId)
  if (!material) {
    throw new ApiError('NOT_FOUND', `No material with id "${materialId}"`, 404)
  }
  if (material.status !== 'READY') {
    throw new ApiError(
      'MATERIAL_NOT_READY',
      `This document is ${material.status.toLowerCase()} and cannot be queried yet`,
      409,
    )
  }

  const chunks = await getChunks(materialId)

  if (chunks.length === 0) {
    return {
      answer: {
        answer: 'This document has no readable content to search.',
        foundInMaterial: false,
        quotedPassages: [],
      },
      sources: [],
    }
  }

  const sources = await hybridRank(question, chunks, TOP_K)
  const weakMatch = sources.every((s) => s.viaFallback)

  // Always call the model now. Deciding whether the document answers a
  // question is a judgement, not a similarity threshold.
  const answer = await generateStructured({
    prompt: groundedPrompt({
      filename: material.filename,
      question,
      passages: sources.map((s) => s.content),
      weakMatch,
    }),
    schema: groundedAnswerSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.2,
    schemaName: 'grounded_answer',
  })

  return { answer, sources }
}

function readStringArray(json: string): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const SUGGESTION_EXCERPT_CHUNKS = 3

export async function getSuggestedQuestions(
  materialId: string,
): Promise<string[]> {
  const material = await findMaterial(materialId)
  if (!material) {
    throw new ApiError('NOT_FOUND', `No material with id "${materialId}"`, 404)
  }

  const cached = readStringArray(material.suggestions)
  if (cached.length > 0) return cached

  const chunks = await getChunks(materialId)
  if (chunks.length === 0) return []

  try {
    const { questions } = await generateStructured({
      prompt: suggestionsPrompt(
        material.filename,
        chunks
          .slice(0, SUGGESTION_EXCERPT_CHUNKS)
          .map((c) => c.content)
          .join('\n\n'),
      ),
      schema: suggestedQuestionsSchema,
      system: TUTOR_SYSTEM,
      temperature: 0.6,
      schemaName: 'suggested_questions',
    })

    await saveSuggestions(materialId, questions)
    return questions
  } catch (error) {
    // Suggestions are a convenience. Never block the page on them.
    console.error('Suggestion generation failed:', error)
    return []
  }
}
