import { describe, expect, it } from 'vitest'
import { findMatchingConceptId } from '@/lib/concept-match'

const concepts = [
  { id: 'c1', name: 'Tokenization' },
  { id: 'c2', name: 'Embeddings' },
  { id: 'c3', name: 'Attention' },
  { id: 'c4', name: 'Zero Trust' },
  { id: 'c5', name: 'CIA Triad' },
]

describe('findMatchingConceptId', () => {
  it('matches exact name', () => {
    expect(findMatchingConceptId('Tokenization', concepts)).toBe('c1')
  })

  it('matches case and whitespace insensitively', () => {
    expect(findMatchingConceptId('  tokenization  ', concepts)).toBe('c1')
    expect(findMatchingConceptId('zero trust', concepts)).toBe('c4')
  })

  it('matches concept when model appends definition with a colon', () => {
    expect(
      findMatchingConceptId(
        'Attention: A mechanism that lets each token weigh relevance',
        concepts,
      ),
    ).toBe('c3')
  })

  it('matches concept with depth annotation', () => {
    expect(findMatchingConceptId('Tokenization (depth 0)', concepts)).toBe('c1')
    expect(
      findMatchingConceptId(
        'Tokenization (depth 0): The process of splitting text',
        concepts,
      ),
    ).toBe('c1')
  })

  it('matches concept with Concept: prefix', () => {
    expect(findMatchingConceptId('Concept: CIA Triad', concepts)).toBe('c5')
  })

  it('matches concept with quotes', () => {
    expect(findMatchingConceptId('"Embeddings"', concepts)).toBe('c2')
  })

  it('matches by substring when model output includes longer descriptor', () => {
    expect(
      findMatchingConceptId('Zero Trust Network Architecture', concepts),
    ).toBe('c4')
  })

  it('returns null for an unknown concept', () => {
    expect(findMatchingConceptId('Nonexistent', concepts)).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(findMatchingConceptId('', concepts)).toBeNull()
    expect(findMatchingConceptId('Attention', [])).toBeNull()
  })
})
