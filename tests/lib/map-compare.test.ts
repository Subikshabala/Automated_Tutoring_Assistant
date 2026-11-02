import { describe, expect, it } from 'vitest'
import { compareMaps, matchLabel, normaliseLabel } from '@/lib/map-compare'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name: string) {
  return {
    id,
    courseId: 'c1',
    name,
    definition: 'd',
    difficulty: 'BEGINNER' as const,
    objectives: [],
  }
}

const canonical: ConceptGraph = {
  concepts: [
    concept('c-tok', 'Tokenization'),
    concept('c-emb', 'Embeddings'),
    concept('c-att', 'Attention'),
  ],
  relationships: [
    { id: 'r1', fromId: 'c-tok', toId: 'c-emb', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r2', fromId: 'c-emb', toId: 'c-att', type: 'PREREQUISITE_OF', strength: 1 },
  ],
}

describe('normaliseLabel', () => {
  it('lowercases and trims', () => {
    expect(normaliseLabel('  Tokenization  ')).toBe('tokenization')
  })

  it('collapses internal whitespace', () => {
    expect(normaliseLabel('context   window')).toBe('context window')
  })

  it('strips punctuation', () => {
    expect(normaliseLabel('self-attention!')).toBe('selfattention')
  })
})

describe('matchLabel', () => {
  const names = ['Tokenization', 'Embeddings', 'Context Window']

  it('matches an exact label', () => {
    expect(matchLabel('Tokenization', names)).toBe('Tokenization')
  })

  it('matches ignoring case', () => {
    expect(matchLabel('tokenization', names)).toBe('Tokenization')
  })

  it('matches ignoring punctuation and spacing', () => {
    expect(matchLabel('context-window', names)).toBe('Context Window')
  })

  it('matches a near miss with one typo', () => {
    expect(matchLabel('Tokenisation', names)).toBe('Tokenization')
  })

  it('returns null for an unrelated label', () => {
    expect(matchLabel('Quantum Entanglement', names)).toBeNull()
  })

  it('does not match a short label to a long one', () => {
    expect(matchLabel('To', names)).toBeNull()
  })
})

describe('compareMaps', () => {
  it('reports a perfect map as fully correct', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' },
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'PREREQUISITE_OF' },
      ],
    })
    expect(result.matchedConcepts).toHaveLength(3)
    expect(result.missingConcepts).toHaveLength(0)
    expect(result.correctEdges).toHaveLength(2)
    expect(result.missingEdges).toHaveLength(0)
    expect(result.incorrectEdges).toHaveLength(0)
    expect(result.score).toBe(100)
  })

  it('reports concepts the learner omitted', () => {
    const result = compareMaps(canonical, {
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(result.missingConcepts).toEqual(['Embeddings', 'Attention'])
  })

  it('reports nodes that match no canonical concept', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Blockchain Consensus', x: 0, y: 0 },
      ],
      edges: [],
    })
    expect(result.unrecognisedNodes).toEqual(['Blockchain Consensus'])
  })

  it('reports an edge the learner drew that does not exist canonically', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' }],
    })
    expect(result.incorrectEdges).toEqual([
      { from: 'Tokenization', to: 'Attention' },
    ])
  })

  it('reports canonical edges the learner did not draw', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' }],
    })
    expect(result.missingEdges).toEqual([
      { from: 'Embeddings', to: 'Attention' },
    ])
  })

  it('credits an edge drawn with the wrong relationship type as present but mistyped', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.correctEdges).toHaveLength(1)
    expect(result.mistypedEdges).toEqual([
      { from: 'Tokenization', to: 'Embeddings', drew: 'RELATED_TO', expected: 'PREREQUISITE_OF' },
    ])
  })

  it('scores an empty-ish map low', () => {
    const result = compareMaps(canonical, {
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(result.score).toBeLessThan(40)
  })

  it('never returns a score above 100', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' },
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'PREREQUISITE_OF' },
      ],
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('handles a canonical graph with no relationships', () => {
    const result = compareMaps(
      { concepts: [concept('c1', 'Solo')], relationships: [] },
      { nodes: [{ id: 'n1', label: 'Solo', x: 0, y: 0 }], edges: [] },
    )
    expect(result.score).toBe(100)
  })

  it('ignores an edge between two unrecognised nodes', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Nonsense A', x: 0, y: 0 },
        { id: 'n2', label: 'Nonsense B', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.incorrectEdges).toEqual([])
    expect(result.unrecognisedNodes).toHaveLength(2)
  })
})
