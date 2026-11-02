import { describe, expect, it } from 'vitest'
import { canTransition, type SourceStatus } from '@/lib/schemas/source'

describe('canTransition', () => {
  const legal: [SourceStatus, SourceStatus][] = [
    ['DRAFT', 'INGESTED'],
    ['DRAFT', 'ARCHIVED'],
    ['INGESTED', 'PROCESSED'],
    ['INGESTED', 'ARCHIVED'],
    ['PROCESSED', 'IN_REVIEW'],
    ['PROCESSED', 'ARCHIVED'],
    ['IN_REVIEW', 'APPROVED'],
    ['IN_REVIEW', 'PROCESSED'],
    ['IN_REVIEW', 'ARCHIVED'],
    ['APPROVED', 'PUBLISHED'],
    ['APPROVED', 'IN_REVIEW'],
    ['APPROVED', 'ARCHIVED'],
    ['PUBLISHED', 'ARCHIVED'],
    ['PUBLISHED', 'IN_REVIEW'],
    ['ARCHIVED', 'DRAFT'],
  ]

  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true)
    })
  }

  it('rejects DRAFT → PUBLISHED', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false)
  })

  it('rejects DRAFT → APPROVED', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('rejects PUBLISHED → DRAFT', () => {
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(false)
  })
})
