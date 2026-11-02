import { describe, expect, it } from 'vitest'
import { computeDepths, layoutGraph } from '@/lib/concept-layout'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name = id) {
  return {
    id,
    courseId: 'c1',
    name,
    definition: 'd',
    difficulty: 'BEGINNER' as const,
    objectives: [],
  }
}

function prereq(fromId: string, toId: string) {
  return {
    id: `${fromId}->${toId}`,
    fromId,
    toId,
    type: 'PREREQUISITE_OF' as const,
    strength: 1,
  }
}

describe('computeDepths', () => {
  it('puts a node with no prerequisites at depth 0', () => {
    const depths = computeDepths([concept('a')], [])
    expect(depths.get('a')).toBe(0)
  })

  it('places a dependent one level deeper than its prerequisite', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [prereq('a', 'b')],
    )
    expect(depths.get('a')).toBe(0)
    expect(depths.get('b')).toBe(1)
  })

  it('uses the longest path when a node has several prerequisites', () => {
    // a -> b -> c, and a -> c directly. c must sit at depth 2, not 1.
    const depths = computeDepths(
      [concept('a'), concept('b'), concept('c')],
      [prereq('a', 'b'), prereq('b', 'c'), prereq('a', 'c')],
    )
    expect(depths.get('c')).toBe(2)
  })

  it('ignores non-prerequisite relationships when assigning depth', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [
        {
          id: 'r',
          fromId: 'a',
          toId: 'b',
          type: 'RELATED_TO' as const,
          strength: 1,
        },
      ],
    )
    expect(depths.get('b')).toBe(0)
  })

  it('does not hang on a cycle', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [prereq('a', 'b'), prereq('b', 'a')],
    )
    expect(depths.size).toBe(2)
    for (const depth of depths.values()) {
      expect(Number.isFinite(depth)).toBe(true)
    }
  })
})

describe('layoutGraph', () => {
  const graph: ConceptGraph = {
    concepts: [concept('a'), concept('b'), concept('c')],
    relationships: [prereq('a', 'b'), prereq('a', 'c')],
  }

  it('returns one node per concept', () => {
    const { nodes } = layoutGraph(graph)
    expect(nodes).toHaveLength(3)
  })

  it('returns one edge per relationship', () => {
    const { edges } = layoutGraph(graph)
    expect(edges).toHaveLength(2)
  })

  it('gives every node a finite position', () => {
    const { nodes } = layoutGraph(graph)
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
  })

  it('places deeper nodes further right', () => {
    const { nodes } = layoutGraph(graph)
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    expect(b.position.x).toBeGreaterThan(a.position.x)
  })

  it('separates siblings vertically', () => {
    const { nodes } = layoutGraph(graph)
    const b = nodes.find((n) => n.id === 'b')!
    const c = nodes.find((n) => n.id === 'c')!
    expect(b.position.y).not.toBe(c.position.y)
  })

  it('tags every edge with its relationship type', () => {
    const { edges } = layoutGraph(graph)
    expect(edges[0].data.type).toBe('PREREQUISITE_OF')
  })

  it('leaves room for an edge label between columns', () => {
    const { nodes } = layoutGraph(graph)
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    // Node is 224px wide; a label needs ~120px of clear space.
    expect(b.position.x - a.position.x).toBeGreaterThanOrEqual(360)
  })

  it('leaves room between stacked siblings', () => {
    const { nodes } = layoutGraph(graph)
    const b = nodes.find((n) => n.id === 'b')!
    const c = nodes.find((n) => n.id === 'c')!
    expect(Math.abs(b.position.y - c.position.y)).toBeGreaterThanOrEqual(150)
  })

  it('exposes the layout constants it used', () => {
    const { bounds } = layoutGraph(graph)
    expect(bounds.columnWidth).toBe(380)
    expect(bounds.rowHeight).toBe(160)
  })
})

describe('crossing reduction', () => {
  // a -> z, b -> y. Declared so the naive order crosses the edges.
  const crossing: ConceptGraph = {
    concepts: [
      concept('a', 'A'),
      concept('b', 'B'),
      concept('y', 'Y'),
      concept('z', 'Z'),
    ],
    relationships: [prereq('a', 'z'), prereq('b', 'y')],
  }

  it('orders the second column to follow its predecessors', () => {
    const { nodes } = layoutGraph(crossing)
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    const y = nodes.find((n) => n.id === 'y')!
    const z = nodes.find((n) => n.id === 'z')!

    // Whatever vertical order the roots land in, each target should sit
    // on the same side as its own source.
    const aAboveB = a.position.y < b.position.y
    const zAboveY = z.position.y < y.position.y
    expect(aAboveB).toBe(zAboveY)
  })

  it('keeps a node with no predecessors in a stable position', () => {
    const orphaned: ConceptGraph = {
      concepts: [concept('a', 'A'), concept('solo', 'Solo')],
      relationships: [],
    }
    const { nodes } = layoutGraph(orphaned)
    expect(nodes).toHaveLength(2)
    expect(nodes.every((n) => Number.isFinite(n.position.y))).toBe(true)
  })

  it('is deterministic across runs', () => {
    const first = layoutGraph(crossing).nodes.map((n) => `${n.id}:${n.position.y}`)
    const second = layoutGraph(crossing).nodes.map((n) => `${n.id}:${n.position.y}`)
    expect(first).toEqual(second)
  })

  it('does not drop or duplicate nodes', () => {
    const { nodes } = layoutGraph(crossing)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(4)
  })
})
