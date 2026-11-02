import { describe, expect, it } from 'vitest'
import { sampleDiagnosticConcepts } from '@/lib/diagnostic'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name: string) {
  return {
    id, courseId: 'c1', name, definition: 'd',
    difficulty: 'BEGINNER' as const, objectives: [],
  }
}
function prereq(fromId: string, toId: string) {
  return { id: `${fromId}>${toId}`, fromId, toId, type: 'PREREQUISITE_OF' as const, strength: 1 }
}

// a -> b -> c -> d, plus two unrelated roots
const graph: ConceptGraph = {
  concepts: ['a','b','c','d','x','y'].map((id) => concept(id, id.toUpperCase())),
  relationships: [prereq('a','b'), prereq('b','c'), prereq('c','d')],
}

describe('sampleDiagnosticConcepts', () => {
  it('returns at most the requested count', () => {
    expect(sampleDiagnosticConcepts(graph, 4)).toHaveLength(4)
  })

  it('returns everything when the graph is smaller than the target', () => {
    const tiny: ConceptGraph = { concepts: [concept('a', 'A')], relationships: [] }
    expect(sampleDiagnosticConcepts(tiny, 8)).toHaveLength(1)
  })

  it('always includes a root concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 3).map((c) => c.id)
    expect(picked.some((id) => ['a', 'x', 'y'].includes(id))).toBe(true)
  })

  it('always includes the deepest concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 3).map((c) => c.id)
    expect(picked).toContain('d')
  })

  it('spreads across depth rather than clustering', () => {
    const picked = sampleDiagnosticConcepts(graph, 4)
    const depths = new Set(picked.map((c) => c.depth))
    expect(depths.size).toBeGreaterThanOrEqual(3)
  })

  it('reports the depth of each pick', () => {
    const picked = sampleDiagnosticConcepts(graph, 4)
    for (const c of picked) {
      expect(typeof c.depth).toBe('number')
    }
  })

  it('is deterministic', () => {
    const a = sampleDiagnosticConcepts(graph, 4).map((c) => c.id)
    const b = sampleDiagnosticConcepts(graph, 4).map((c) => c.id)
    expect(a).toEqual(b)
  })

  it('never repeats a concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 6)
    expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length)
  })

  it('handles a graph with no relationships', () => {
    const flat: ConceptGraph = {
      concepts: ['p','q','r'].map((id) => concept(id, id)),
      relationships: [],
    }
    expect(sampleDiagnosticConcepts(flat, 2)).toHaveLength(2)
  })

  it('returns an empty array for an empty graph', () => {
    expect(sampleDiagnosticConcepts({ concepts: [], relationships: [] }, 5)).toEqual([])
  })
})
