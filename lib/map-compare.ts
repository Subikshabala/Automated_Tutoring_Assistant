import type { ConceptGraph, RelationshipType } from '@/lib/schemas/concept'
import type { StudentEdge, StudentNode } from '@/lib/schemas/student-map'

export function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein distance, capped early for performance on long strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    previous = current
  }

  return previous[b.length]
}

/**
 * Matches a learner label to a canonical concept name.
 * Exact normalised match wins; otherwise allows a small edit distance
 * proportional to the label length, so "Tokenisation" matches
 * "Tokenization" but "To" matches nothing.
 */
export function matchLabel(
  label: string,
  canonicalNames: string[],
): string | null {
  const target = normaliseLabel(label)
  if (target.length === 0) return null

  for (const name of canonicalNames) {
    if (normaliseLabel(name) === target) return name
  }

  const tolerance = Math.floor(target.length / 6) + 1

  let best: { name: string; distance: number } | null = null
  for (const name of canonicalNames) {
    const candidate = normaliseLabel(name)
    if (Math.abs(candidate.length - target.length) > tolerance) continue

    const distance = editDistance(target, candidate)
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { name, distance }
    }
  }

  return best?.name ?? null
}

export type EdgeRef = { from: string; to: string }

export type MistypedEdge = EdgeRef & {
  drew: RelationshipType
  expected: RelationshipType
}

export type MapComparison = {
  matchedConcepts: string[]
  missingConcepts: string[]
  unrecognisedNodes: string[]
  correctEdges: EdgeRef[]
  missingEdges: EdgeRef[]
  incorrectEdges: EdgeRef[]
  mistypedEdges: MistypedEdge[]
  score: number
}

const CONCEPT_WEIGHT = 0.5
const EDGE_WEIGHT = 0.5

export function compareMaps(
  canonical: ConceptGraph,
  student: { nodes: StudentNode[]; edges: StudentEdge[] },
): MapComparison {
  const canonicalNames = canonical.concepts.map((c) => c.name)
  const nameById = new Map(canonical.concepts.map((c) => [c.id, c.name]))

  // Student node id -> canonical concept name (or null if unrecognised).
  const matchByNodeId = new Map<string, string | null>()
  const matchedConcepts = new Set<string>()
  const unrecognisedNodes: string[] = []

  for (const node of student.nodes) {
    const match = matchLabel(node.label, canonicalNames)
    matchByNodeId.set(node.id, match)
    if (match) {
      matchedConcepts.add(match)
    } else {
      unrecognisedNodes.push(node.label)
    }
  }

  const missingConcepts = canonicalNames.filter(
    (name) => !matchedConcepts.has(name),
  )

  // Canonical edges keyed by "from||to" on concept names.
  const canonicalEdges = new Map<string, RelationshipType>()
  for (const rel of canonical.relationships) {
    const from = nameById.get(rel.fromId)
    const to = nameById.get(rel.toId)
    if (from && to) canonicalEdges.set(`${from}||${to}`, rel.type)
  }

  const correctEdges: EdgeRef[] = []
  const incorrectEdges: EdgeRef[] = []
  const mistypedEdges: MistypedEdge[] = []
  const drawnKeys = new Set<string>()

  for (const edge of student.edges) {
    const from = matchByNodeId.get(edge.fromId)
    const to = matchByNodeId.get(edge.toId)

    // An edge touching an unrecognised node cannot be judged.
    if (!from || !to) continue

    const key = `${from}||${to}`
    drawnKeys.add(key)

    const expected = canonicalEdges.get(key)
    if (expected) {
      correctEdges.push({ from, to })
      if (expected !== edge.type) {
        mistypedEdges.push({ from, to, drew: edge.type, expected })
      }
    } else {
      incorrectEdges.push({ from, to })
    }
  }

  const missingEdges: EdgeRef[] = []
  for (const key of canonicalEdges.keys()) {
    if (drawnKeys.has(key)) continue
    const [from, to] = key.split('||')
    missingEdges.push({ from, to })
  }

  const conceptRatio =
    canonicalNames.length === 0
      ? 1
      : matchedConcepts.size / canonicalNames.length

  const edgeRatio =
    canonicalEdges.size === 0 ? 1 : correctEdges.length / canonicalEdges.size

  const penalty =
    incorrectEdges.length > 0
      ? Math.min(0.2, incorrectEdges.length * 0.05)
      : 0

  const raw = conceptRatio * CONCEPT_WEIGHT + edgeRatio * EDGE_WEIGHT - penalty
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)))

  return {
    matchedConcepts: [...matchedConcepts],
    missingConcepts,
    unrecognisedNodes,
    correctEdges,
    missingEdges,
    incorrectEdges,
    mistypedEdges,
    score,
  }
}
