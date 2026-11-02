import { describe, expect, it } from 'vitest'
import { getNeighbours } from '@/components/concept-map-canvas'
import type { ConceptGraph } from '@/lib/schemas/concept'

const graph: ConceptGraph = {
  concepts: [
    { id: 'a', courseId: 'c', name: 'A', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
    { id: 'b', courseId: 'c', name: 'B', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
    { id: 'c', courseId: 'c', name: 'C', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
  ],
  relationships: [
    { id: 'r1', fromId: 'a', toId: 'b', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r2', fromId: 'b', toId: 'c', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r3', fromId: 'a', toId: 'c', type: 'RELATED_TO', strength: 1 },
  ],
}

describe('getNeighbours', () => {
  it('returns empty lists when nothing is selected', () => {
    expect(getNeighbours(graph, null)).toEqual({ prerequisites: [], unlocks: [] })
  })

  it('finds the prerequisites of a concept', () => {
    const { prerequisites } = getNeighbours(graph, 'b')
    expect(prerequisites).toEqual([{ id: 'a', name: 'A' }])
  })

  it('finds what a concept unlocks', () => {
    const { unlocks } = getNeighbours(graph, 'b')
    expect(unlocks).toEqual([{ id: 'c', name: 'C' }])
  })

  it('ignores non-prerequisite edges', () => {
    const { prerequisites } = getNeighbours(graph, 'c')
    expect(prerequisites).toEqual([{ id: 'b', name: 'B' }])
  })

  it('returns empty lists for a root concept', () => {
    expect(getNeighbours(graph, 'a').prerequisites).toEqual([])
  })
})
