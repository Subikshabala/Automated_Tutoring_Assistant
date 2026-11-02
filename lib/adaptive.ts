import type { ConceptGraph } from '@/lib/schemas/concept'
import type { MasteryWithConcept } from '@/lib/repositories/mastery'
import type {
  LearningAction,
  Recommendation,
} from '@/lib/schemas/recommendation'

/** A prerequisite must reach this score before its dependents unlock. */
export const READINESS_THRESHOLD = 65

/** At or above this, a concept is considered done and drops out of recommendations. */
export const MASTERED_THRESHOLD = 80

/** Below this, a concept needs reteaching rather than practice. */
export const REVIEW_THRESHOLD = 50

const DEFAULT_LIMIT = 6

export function isReady(
  conceptId: string,
  graph: ConceptGraph,
  scoreByConcept: Map<string, number>,
): boolean {
  const prerequisites = graph.relationships.filter(
    (r) => r.type === 'PREREQUISITE_OF' && r.toId === conceptId,
  )

  return prerequisites.every(
    (r) => (scoreByConcept.get(r.fromId) ?? 0) >= READINESS_THRESHOLD,
  )
}

function actionFor(score: number, started: boolean): LearningAction {
  if (!started) return 'LEARN'
  if (score < REVIEW_THRESHOLD) return 'REVIEW'
  return 'PRACTISE'
}

/**
 * Priority bands, highest first:
 *   REVIEW   90..100 — a weak foundation blocks everything downstream
 *   PRACTISE 60..80  — close to mastery, cheap to finish
 *   LEARN    30..55  — new ground, ready to start
 * Within a band, lower mastery and more unlocked dependents rank higher.
 */
function priorityFor(
  action: LearningAction,
  score: number,
  unlocksCount: number,
): number {
  const unlockBonus = Math.min(10, unlocksCount * 3)

  if (action === 'REVIEW') {
    return Math.min(100, 90 + Math.round((REVIEW_THRESHOLD - score) / 5))
  }
  if (action === 'PRACTISE') {
    return Math.min(
      80,
      60 + Math.round((MASTERED_THRESHOLD - score) / 2) + unlockBonus,
    )
  }
  return Math.min(55, 30 + unlockBonus)
}

// ---------------------------------------------------------------------------
// Situation classification
// ---------------------------------------------------------------------------

export type Situation =
  | 'FIRST_STEP'
  | 'NEWLY_UNLOCKED'
  | 'READY'
  | 'GATEWAY'
  | 'NEARLY_THERE'
  | 'SHAKY'
  | 'BLOCKED_DOWNSTREAM'
  | 'FOUNDATIONAL_GAP'

export type SituationInput = {
  score: number
  started: boolean
  /** How many concepts the learner has touched in this course. */
  totalStarted: number
  unlocksCount: number
  prerequisiteCount: number
  /** True when every prerequisite crossed the threshold on the last attempt. */
  justUnlocked?: boolean
}

/** Unlocking this many concepts makes a concept worth calling out. */
const GATEWAY_THRESHOLD = 3

export function classifySituation(input: SituationInput): Situation {
  if (!input.started) {
    if (input.totalStarted === 0 && input.prerequisiteCount === 0) {
      return 'FIRST_STEP'
    }
    if (input.justUnlocked) return 'NEWLY_UNLOCKED'
    if (input.unlocksCount >= GATEWAY_THRESHOLD) return 'GATEWAY'
    return 'READY'
  }

  if (input.score >= 65) return 'NEARLY_THERE'
  if (input.score >= 50) return 'SHAKY'
  return input.unlocksCount > 0 ? 'BLOCKED_DOWNSTREAM' : 'FOUNDATIONAL_GAP'
}

// ---------------------------------------------------------------------------
// Situation-aware copy
// ---------------------------------------------------------------------------

export type ReasonInput = {
  conceptName: string
  score: number
  unlocks: string[]
  prerequisites: string[]
  /** Position in the recommendation list, used to vary phrasing. */
  index: number
}

function list(names: string[], limit = 2): string {
  const taken = names.slice(0, limit)
  if (taken.length === 0) return ''
  if (taken.length === 1) return taken[0]
  return `${taken.slice(0, -1).join(', ')} and ${taken[taken.length - 1]}`
}

type Phrasing = (i: ReasonInput) => string

const PHRASINGS: Record<Situation, Phrasing[]> = {
  FIRST_STEP: [
    (i) => `Start here. ${i.conceptName} has no prerequisites, and most of this course builds on it.`,
    (i) => `${i.conceptName} is the entry point — nothing else needs to come first.`,
  ],

  NEWLY_UNLOCKED: [
    (i) => `You just cleared ${list(i.prerequisites)}, which opens ${i.conceptName}.`,
    (i) => `${i.conceptName} is now available — ${list(i.prerequisites)} is solid enough to build on.`,
  ],

  GATEWAY: [
    (i) => `${i.conceptName} unlocks ${i.unlocks.length} later concepts, including ${list(i.unlocks)}. Worth doing before the others.`,
    (i) => `A lot depends on ${i.conceptName} — ${list(i.unlocks)} and more sit behind it.`,
  ],

  READY: [
    (i) => `${i.conceptName} is open. Its prerequisites are covered.`,
    (i) => `Nothing is blocking ${i.conceptName}${i.unlocks.length > 0 ? `, and it leads into ${list(i.unlocks, 1)}` : ''}.`,
    (i) => `You can take ${i.conceptName} next whenever you want.`,
  ],

  NEARLY_THERE: [
    (i) => `${i.score} on ${i.conceptName}. One more set of questions should finish it.`,
    (i) => `${i.conceptName} is close — ${i.score} out of 100. The gap is small.`,
  ],

  SHAKY: [
    (i) => `${i.score} on ${i.conceptName} suggests the shape is there but the detail is not.`,
    (i) => `You are halfway on ${i.conceptName} at ${i.score}. Another pass should settle it.`,
  ],

  BLOCKED_DOWNSTREAM: [
    (i) => `${i.conceptName} is at ${i.score}, and ${list(i.unlocks)} depends on it. Worth fixing before moving on.`,
    (i) => `${list(i.unlocks)} will be harder while ${i.conceptName} sits at ${i.score}.`,
  ],

  FOUNDATIONAL_GAP: [
    (i) => `${i.score} on ${i.conceptName}. Reread the explanation before trying more questions.`,
    (i) => `${i.conceptName} has not landed yet — ${i.score} out of 100.`,
  ],
}

export function reasonFor(situation: Situation, input: ReasonInput): string {
  const options = PHRASINGS[situation]
  return options[input.index % options.length](input)
}

// ---------------------------------------------------------------------------
// Main recommend function
// ---------------------------------------------------------------------------

export function recommend(
  graph: ConceptGraph,
  masteryRecords: MasteryWithConcept[],
  courseSlug: string,
  limit: number = DEFAULT_LIMIT,
): Recommendation[] {
  if (graph.concepts.length === 0) return []

  const scoreByConcept = new Map(
    masteryRecords.map((m) => [m.conceptId, m.masteryScore]),
  )
  const startedConcepts = new Set(
    masteryRecords.filter((m) => m.attemptCount > 0).map((m) => m.conceptId),
  )
  const startedCount = startedConcepts.size
  const nameById = new Map(graph.concepts.map((c) => [c.id, c.name]))

  const unlocksByConcept = new Map<string, string[]>()
  for (const rel of graph.relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    const targetName = nameById.get(rel.toId)
    if (!targetName) continue
    const bucket = unlocksByConcept.get(rel.fromId)
    if (bucket) {
      bucket.push(targetName)
    } else {
      unlocksByConcept.set(rel.fromId, [targetName])
    }
  }

  // Build a map of prerequisite names for each concept.
  const prerequisiteNamesByConcept = new Map<string, string[]>()
  for (const rel of graph.relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    const fromName = nameById.get(rel.fromId)
    if (!fromName) continue
    const bucket = prerequisiteNamesByConcept.get(rel.toId)
    if (bucket) {
      bucket.push(fromName)
    } else {
      prerequisiteNamesByConcept.set(rel.toId, [fromName])
    }
  }

  const prerequisiteCount = (id: string) =>
    graph.relationships.filter(
      (r) => r.type === 'PREREQUISITE_OF' && r.toId === id,
    ).length

  const recommendations: Recommendation[] = []

  for (const concept of graph.concepts) {
    const score = scoreByConcept.get(concept.id) ?? 0
    const started = startedConcepts.has(concept.id)

    if (score >= MASTERED_THRESHOLD) continue
    if (!started && !isReady(concept.id, graph, scoreByConcept)) continue

    const action = actionFor(score, started)
    const unlocks = unlocksByConcept.get(concept.id) ?? []
    const prerequisites = prerequisiteNamesByConcept.get(concept.id) ?? []

    const situation = classifySituation({
      score,
      started,
      totalStarted: startedCount,
      unlocksCount: unlocks.length,
      prerequisiteCount: prerequisiteCount(concept.id),
    })

    recommendations.push({
      conceptId: concept.id,
      conceptName: concept.name,
      courseSlug,
      topicId: concept.topicId ?? null,
      action,
      situation,
      // Index assigned after sorting, below.
      reason: '',
      priority: priorityFor(action, score, unlocks.length),
      masteryScore: score,
      unlocks,
      prerequisites,
    })
  }

  // Sort first, then write reasons — phrasing varies by final position.
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((rec, index) => ({
      ...rec,
      reason: reasonFor(rec.situation, {
        conceptName: rec.conceptName,
        score: rec.masteryScore,
        unlocks: rec.unlocks,
        prerequisites: rec.prerequisites,
        index,
      }),
    }))
}
