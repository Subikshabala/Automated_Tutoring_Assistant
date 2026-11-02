import { generateStructured } from '@/lib/ai/client'
import { mapFeedbackPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'
import { mapFeedbackSchema, type MapFeedback } from '@/lib/schemas/student-map'
import type { MapComparison } from '@/lib/map-compare'

function fallback(comparison: MapComparison): MapFeedback {
  const gaps: string[] = []

  if (comparison.missingConcepts.length > 0) {
    gaps.push(
      `Missing concepts: ${comparison.missingConcepts.slice(0, 3).join(', ')}.`,
    )
  }
  if (comparison.missingEdges.length > 0) {
    const edges = comparison.missingEdges
      .slice(0, 3)
      .map((e) => `${e.from} to ${e.to}`)
      .join(', ')
    gaps.push(`Missing connections: ${edges}.`)
  }
  if (comparison.incorrectEdges.length > 0) {
    const edges = comparison.incorrectEdges
      .slice(0, 3)
      .map((e) => `${e.from} to ${e.to}`)
      .join(', ')
    gaps.push(`Connections not in the course map: ${edges}.`)
  }

  const strengths: string[] = []
  if (comparison.matchedConcepts.length > 0) {
    strengths.push(
      `You identified ${comparison.matchedConcepts.length} course concepts.`,
    )
  }
  if (comparison.correctEdges.length > 0) {
    strengths.push(
      `${comparison.correctEdges.length} of your connections match the course map.`,
    )
  }

  return {
    summary: `Your map scored ${comparison.score} out of 100 against the course map.`,
    strengths,
    gaps,
    nextStep:
      comparison.missingConcepts.length > 0
        ? `Read up on ${comparison.missingConcepts[0]}, then add it to your map.`
        : 'Review the connections you missed and redraw them.',
  }
}

export async function generateMapFeedback(
  courseTitle: string,
  comparison: MapComparison,
): Promise<MapFeedback> {
  try {
    return await generateStructured({
      prompt: mapFeedbackPrompt({
        courseTitle,
        score: comparison.score,
        matchedConcepts: comparison.matchedConcepts,
        missingConcepts: comparison.missingConcepts,
        unrecognisedNodes: comparison.unrecognisedNodes,
        correctEdges: comparison.correctEdges,
        missingEdges: comparison.missingEdges,
        incorrectEdges: comparison.incorrectEdges,
      }),
      schema: mapFeedbackSchema,
      system: TUTOR_SYSTEM,
      temperature: 0.4,
    })
  } catch (error) {
    console.error('Map feedback generation failed, using fallback:', error)
    return fallback(comparison)
  }
}
