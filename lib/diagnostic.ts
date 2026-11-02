import { computeDepths } from '@/lib/concept-layout'
import type { ConceptDto, ConceptGraph } from '@/lib/schemas/concept'

export type DiagnosticConcept = ConceptDto & { depth: number }

export const DEFAULT_DIAGNOSTIC_SIZE = 7

/**
 * Picks concepts spanning the prerequisite graph's depth range.
 *
 * A diagnostic should locate the boundary of understanding, so it needs
 * coverage from roots to leaves rather than a random sample that might
 * land entirely in the shallows.
 */
export function sampleDiagnosticConcepts(
  graph: ConceptGraph,
  count: number = DEFAULT_DIAGNOSTIC_SIZE,
): DiagnosticConcept[] {
  if (graph.concepts.length === 0) return []
  if (graph.concepts.length <= count) {
    const depths = computeDepths(graph.concepts, graph.relationships)
    return graph.concepts.map((c) => ({ ...c, depth: depths.get(c.id) ?? 0 }))
  }

  const depths = computeDepths(graph.concepts, graph.relationships)

  const byDepth = new Map<number, ConceptDto[]>()
  for (const concept of graph.concepts) {
    const depth = depths.get(concept.id) ?? 0
    const bucket = byDepth.get(depth)
    if (bucket) bucket.push(concept)
    else byDepth.set(depth, [concept])
  }

  const levels = [...byDepth.keys()].sort((a, b) => a - b)
  const picked: DiagnosticConcept[] = []
  const taken = new Set<string>()

  const take = (depth: number) => {
    const bucket = byDepth.get(depth)
    if (!bucket) return
    // Name sort keeps the pick deterministic across runs.
    const next = [...bucket]
      .sort((a, b) => a.name.localeCompare(b.name))
      .find((c) => !taken.has(c.id))
    if (!next) return
    taken.add(next.id)
    picked.push({ ...next, depth })
  }

  // Anchor the extremes first — they define the range being probed.
  take(levels[0])
  if (levels.length > 1) take(levels[levels.length - 1])

  // Fill the middle, cycling depth levels so coverage stays even.
  let cursor = 0
  while (picked.length < count && taken.size < graph.concepts.length) {
    take(levels[cursor % levels.length])
    cursor += 1
    if (cursor > levels.length * graph.concepts.length) break
  }

  return picked.slice(0, count)
}
