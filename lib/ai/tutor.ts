import { ApiError } from '@/lib/api'
import { generateStructured } from '@/lib/ai/client'
import { resolveProvider } from '@/lib/ai/providers'
import { askPrompt, explainPrompt, TUTOR_SYSTEM, type ChatTurn, type TutorContext } from '@/lib/ai/prompts'
import {
  conceptExplanationSchema,
  tutorAnswerSchema,
  type ConceptExplanation,
  type TutorAnswer,
} from '@/lib/schemas/ai'
import { findConceptById } from '@/lib/repositories/concept'
import {
  findCachedExplanation,
  saveExplanation,
} from '@/lib/repositories/explanation'

async function loadContext(conceptId: string): Promise<TutorContext> {
  const concept = await findConceptById(conceptId)
  if (!concept) {
    throw new ApiError('NOT_FOUND', `No concept with id "${conceptId}"`, 404)
  }
  return {
    conceptName: concept.name,
    conceptDefinition: concept.definition,
    courseTitle: concept.courseTitle,
    topicTitle: concept.topicTitle,
    objectives: concept.objectives,
  }
}

export async function explainConcept(
  conceptId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{ explanation: ConceptExplanation; cached: boolean }> {
  const context = await loadContext(conceptId)

  if (!options.forceRefresh) {
    const cached = await findCachedExplanation(conceptId)
    if (cached) return { explanation: cached, cached: true }
  }

  const explanation = await generateStructured({
    prompt: explainPrompt(context),
    schema: conceptExplanationSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.3,
  })

  await saveExplanation(
    conceptId,
    explanation,
    resolveProvider().model,
  )

  return { explanation, cached: false }
}

export async function answerQuestion(
  conceptId: string,
  question: string,
  history: ChatTurn[],
): Promise<TutorAnswer> {
  const context = await loadContext(conceptId)

  return generateStructured({
    prompt: askPrompt({ ...context, question, history }),
    schema: tutorAnswerSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.5,
  })
}
