import type {
  ConceptDto,
  ConceptGraph,
  ConceptRelationshipDto,
  RelationshipType,
} from '@/lib/schemas/concept'

export type LaidOutNode = {
  id: string
  type: 'concept'
  position: { x: number; y: number }
  data: { concept: ConceptDto }
}

export type LaidOutEdge = {
  id: string
  source: string
  target: string
  data: { type: RelationshipType }
}

export type LayoutBounds = {
  columnWidth: number
  rowHeight: number
  columns: number
  maxRows: number
  width: number
  height: number
}

/**
 * Node is w-56 (224px). 380 leaves ~156px of clear horizontal space,
 * enough for an edge plus a centred label without overlapping a node.
 */
const COLUMN_WIDTH = 380

/**
 * Node renders ~88px tall (title + 2-line clamped definition).
 * 160 gives ~72px of vertical breathing room.
 */
const ROW_HEIGHT = 160

export const NODE_WIDTH = 224
export const NODE_HEIGHT = 88

const MAX_ITERATIONS = 50

/**
 * Longest-path depth for each concept, following PREREQUISITE_OF edges only.
 * Relaxation is capped so a cyclic graph terminates instead of hanging.
 */
export function computeDepths(
  concepts: ConceptDto[],
  relationships: ConceptRelationshipDto[],
): Map<string, number> {
  const depths = new Map<string, number>()
  for (const concept of concepts) {
    depths.set(concept.id, 0)
  }

  const prerequisites = relationships.filter(
    (r) => r.type === 'PREREQUISITE_OF',
  )

  const limit = Math.min(concepts.length, MAX_ITERATIONS)

  for (let i = 0; i < limit; i++) {
    let changed = false
    for (const rel of prerequisites) {
      const from = depths.get(rel.fromId)
      const to = depths.get(rel.toId)
      if (from === undefined || to === undefined) continue
      if (to < from + 1) {
        depths.set(rel.toId, from + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  return depths
}

const BARYCENTRE_SWEEPS = 2

/**
 * Sugiyama crossing reduction. Sorts each column by the mean row index of
 * its predecessors, so an edge tends to run straight across rather than
 * diagonally past its neighbours.
 *
 * Mutates the arrays in `byDepth` in place.
 */
function reduceCrossings(
  byDepth: Map<number, ConceptDto[]>,
  relationships: ConceptRelationshipDto[],
): void {
  const predecessors = new Map<string, string[]>()
  for (const rel of relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    const bucket = predecessors.get(rel.toId)
    if (bucket) {
      bucket.push(rel.fromId)
    } else {
      predecessors.set(rel.toId, [rel.fromId])
    }
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b)

  for (let sweep = 0; sweep < BARYCENTRE_SWEEPS; sweep++) {
    // Row index of every node as currently ordered.
    const rowOf = new Map<string, number>()
    for (const depth of depths) {
      byDepth.get(depth)!.forEach((c, i) => rowOf.set(c.id, i))
    }

    // Left to right, skipping roots — they have nothing to follow.
    for (const depth of depths.slice(1)) {
      const column = byDepth.get(depth)!

      const barycentre = new Map<string, number>()
      column.forEach((concept, index) => {
        const preds = predecessors.get(concept.id) ?? []
        const rows = preds
          .map((id) => rowOf.get(id))
          .filter((r): r is number => r !== undefined)

        // No predecessors: keep current position so sorting stays stable.
        barycentre.set(
          concept.id,
          rows.length === 0
            ? index
            : rows.reduce((s, r) => s + r, 0) / rows.length,
        )
      })

      column.sort((a, b) => {
        const diff = barycentre.get(a.id)! - barycentre.get(b.id)!
        // Tie-break on name so the layout is deterministic.
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
    }
  }
}

export function layoutGraph(graph: ConceptGraph): {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  bounds: LayoutBounds
} {
  const depths = computeDepths(graph.concepts, graph.relationships)

  const byDepth = new Map<number, ConceptDto[]>()
  for (const concept of graph.concepts) {
    const depth = depths.get(concept.id) ?? 0
    const bucket = byDepth.get(depth)
    if (bucket) {
      bucket.push(concept)
    } else {
      byDepth.set(depth, [concept])
    }
  }

  reduceCrossings(byDepth, graph.relationships)

  const nodes: LaidOutNode[] = []
  for (const [depth, bucket] of byDepth) {
    const offset = ((bucket.length - 1) * ROW_HEIGHT) / 2
    bucket.forEach((concept, index) => {
      nodes.push({
        id: concept.id,
        type: 'concept',
        position: {
          x: depth * COLUMN_WIDTH,
          y: index * ROW_HEIGHT - offset,
        },
        data: { concept },
      })
    })
  }

  const edges: LaidOutEdge[] = graph.relationships.map((rel) => ({
    id: rel.id,
    source: rel.fromId,
    target: rel.toId,
    data: { type: rel.type },
  }))

  const columns = byDepth.size
  const maxRows = Math.max(1, ...[...byDepth.values()].map((b) => b.length))

  const bounds: LayoutBounds = {
    columnWidth: COLUMN_WIDTH,
    rowHeight: ROW_HEIGHT,
    columns,
    maxRows,
    width: columns * COLUMN_WIDTH + NODE_WIDTH,
    height: maxRows * ROW_HEIGHT + NODE_HEIGHT,
  }

  return { nodes, edges, bounds }
}
