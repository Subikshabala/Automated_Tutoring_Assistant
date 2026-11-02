import { generateStructured } from '@/lib/ai/client'
import { coachPrompt, TUTOR_SYSTEM, type CoachRequest } from '@/lib/ai/prompts'
import {
  coachSummarySchema,
  type CoachSummary,
} from '@/lib/schemas/recommendation'

function fallback(request: CoachRequest): CoachSummary {
  const next = request.topRecommendations[0]

  const headline =
    request.startedCount === 0
      ? 'Ready to start'
      : `${request.masteredCount} of ${request.totalCount} concepts mastered`

  const body = next
    ? `You have started ${request.startedCount} concepts. Next: ${next.action.toLowerCase()} ${next.conceptName}.`
    : `You have started ${request.startedCount} of ${request.totalCount} concepts. Nothing is outstanding right now.`

  return { headline, body }
}

export async function generateCoachSummary(
  request: CoachRequest,
): Promise<CoachSummary> {
  try {
    return await generateStructured({
      prompt: coachPrompt(request),
      schema: coachSummarySchema,
      system: TUTOR_SYSTEM,
      temperature: 0.5,
    })
  } catch (error) {
    console.error('Coach summary generation failed, using fallback:', error)
    return fallback(request)
  }
}
