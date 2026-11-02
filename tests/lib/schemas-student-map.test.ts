import { describe, expect, it } from 'vitest'
import {
  mapFeedbackSchema,
  saveMapSchema,
  studentEdgeSchema,
  studentNodeSchema,
} from '@/lib/schemas/student-map'

describe('studentNodeSchema', () => {
  it('accepts a well formed node', () => {
    const parsed = studentNodeSchema.parse({
      id: 'n1',
      label: 'Tokenization',
      x: 10,
      y: 20,
    })
    expect(parsed.label).toBe('Tokenization')
  })

  it('rejects an empty label', () => {
    expect(
      studentNodeSchema.safeParse({ id: 'n1', label: '', x: 0, y: 0 }).success,
    ).toBe(false)
  })

  it('rejects a label over 80 characters', () => {
    expect(
      studentNodeSchema.safeParse({
        id: 'n1',
        label: 'a'.repeat(81),
        x: 0,
        y: 0,
      }).success,
    ).toBe(false)
  })

  it('defaults coordinates to zero', () => {
    const parsed = studentNodeSchema.parse({ id: 'n1', label: 'X' })
    expect(parsed.x).toBe(0)
    expect(parsed.y).toBe(0)
  })
})

describe('studentEdgeSchema', () => {
  it('accepts a well formed edge', () => {
    const parsed = studentEdgeSchema.parse({
      id: 'e1',
      fromId: 'n1',
      toId: 'n2',
      type: 'PREREQUISITE_OF',
    })
    expect(parsed.type).toBe('PREREQUISITE_OF')
  })

  it('defaults the type to RELATED_TO', () => {
    const parsed = studentEdgeSchema.parse({
      id: 'e1',
      fromId: 'n1',
      toId: 'n2',
    })
    expect(parsed.type).toBe('RELATED_TO')
  })

  it('rejects an unknown relationship type', () => {
    expect(
      studentEdgeSchema.safeParse({
        id: 'e1',
        fromId: 'n1',
        toId: 'n2',
        type: 'CAUSES',
      }).success,
    ).toBe(false)
  })
})

describe('saveMapSchema', () => {
  const valid = {
    courseSlug: 'generative-ai',
    title: 'My first attempt',
    nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
    edges: [],
  }

  it('accepts a map with one node and no edges', () => {
    expect(saveMapSchema.parse(valid).nodes).toHaveLength(1)
  })

  it('rejects a map with no nodes', () => {
    expect(saveMapSchema.safeParse({ ...valid, nodes: [] }).success).toBe(false)
  })

  it('rejects a map with more than 60 nodes', () => {
    const nodes = Array.from({ length: 61 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      x: 0,
      y: 0,
    }))
    expect(saveMapSchema.safeParse({ ...valid, nodes }).success).toBe(false)
  })

  it('rejects an edge referencing a node not in the map', () => {
    const result = saveMapSchema.safeParse({
      ...valid,
      edges: [{ id: 'e1', fromId: 'n1', toId: 'ghost', type: 'RELATED_TO' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts an edge between two present nodes', () => {
    const result = saveMapSchema.safeParse({
      ...valid,
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0 },
        { id: 'n2', label: 'B', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('mapFeedbackSchema', () => {
  it('accepts a well formed feedback object', () => {
    const parsed = mapFeedbackSchema.parse({
      summary: 'A solid first map with one structural gap.',
      strengths: ['You linked tokenization to embeddings correctly.'],
      gaps: ['The context window is missing.'],
      nextStep: 'Read the context window concept, then add it.',
    })
    expect(parsed.strengths).toHaveLength(1)
  })

  it('defaults the list fields to empty arrays', () => {
    const parsed = mapFeedbackSchema.parse({
      summary: 's',
      nextStep: 'n',
    })
    expect(parsed.strengths).toEqual([])
    expect(parsed.gaps).toEqual([])
  })

  it('rejects an empty summary', () => {
    expect(
      mapFeedbackSchema.safeParse({ summary: '', nextStep: 'n' }).success,
    ).toBe(false)
  })
})
