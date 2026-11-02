import { describe, expect, it } from 'vitest'
import { EDGE_STYLES, edgeStyleFor } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'

const ALL: RelationshipType[] = [
  'PREREQUISITE_OF',
  'RELATED_TO',
  'PART_OF',
  'LEADS_TO',
]

describe('EDGE_STYLES', () => {
  it('covers every relationship type', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type]).toBeDefined()
    }
  })

  it('gives every type a label', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type].label.length).toBeGreaterThan(0)
    }
  })

  it('animates only prerequisites', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.animated).toBe(true)
    expect(EDGE_STYLES.RELATED_TO.animated).toBe(false)
    expect(EDGE_STYLES.PART_OF.animated).toBe(false)
    expect(EDGE_STYLES.LEADS_TO.animated).toBe(false)
  })

  it('marks direction only on directional types', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.directed).toBe(true)
    expect(EDGE_STYLES.LEADS_TO.directed).toBe(true)
    expect(EDGE_STYLES.RELATED_TO.directed).toBe(false)
  })

  it('uses css variables, never hex', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type].stroke).toMatch(/^var\(--/)
    }
  })

  it('distinguishes types by dash pattern', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.dash).toBeUndefined()
    expect(EDGE_STYLES.RELATED_TO.dash).toBeDefined()
    expect(EDGE_STYLES.PART_OF.dash).toBeDefined()
    expect(EDGE_STYLES.RELATED_TO.dash).not.toBe(EDGE_STYLES.PART_OF.dash)
  })
})

describe('edgeStyleFor', () => {
  it('returns the matching style', () => {
    expect(edgeStyleFor('PREREQUISITE_OF').label).toBe('requires')
  })

  it('falls back to RELATED_TO for an unknown type', () => {
    expect(edgeStyleFor('NONSENSE' as RelationshipType).label).toBe('related')
  })
})
