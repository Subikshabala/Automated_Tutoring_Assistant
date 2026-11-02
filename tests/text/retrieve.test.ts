import { describe, expect, it } from 'vitest'
import { rankChunks, tokenize } from '@/lib/text/retrieve'

const chunks = [
  { id: 'c1', content: 'Tokenization splits text into subword units for the model.', order: 0 },
  { id: 'c2', content: 'Embeddings are dense vectors that encode semantic similarity.', order: 1 },
  { id: 'c3', content: 'The context window bounds how many tokens fit in one pass.', order: 2 },
]

describe('tokenize', () => {
  it('lowercases every term', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world'])
  })

  it('strips punctuation', () => {
    expect(tokenize('hello, world!')).toEqual(['hello', 'world'])
  })

  it('drops stopwords', () => {
    expect(tokenize('the quick brown fox')).toEqual(['quick', 'brown', 'fox'])
  })

  it('drops single-character terms', () => {
    expect(tokenize('a b cd')).toEqual(['cd'])
  })

  it('returns an empty array for a stopword-only string', () => {
    expect(tokenize('the and of')).toEqual([])
  })

  it('keeps intent-bearing verbs', () => {
    expect(tokenize('summarize this document')).toContain('summarize')
    expect(tokenize('explain the process')).toContain('explain')
    expect(tokenize('compare these options')).toContain('compare')
  })

  it('keeps question words that narrow meaning', () => {
    expect(tokenize('how does install work')).toContain('install')
    expect(tokenize('why use subwords')).toContain('subwords')
  })

  it('still drops pure function words', () => {
    expect(tokenize('the and of is a')).toEqual([])
  })

  it('keeps short technical acronyms', () => {
    expect(tokenize('what is CIA triad')).toContain('cia')
  })
})

describe('rankChunks', () => {
  it('ranks the matching chunk first', () => {
    const ranked = rankChunks('What is tokenization?', chunks, 3)
    expect(ranked[0].id).toBe('c1')
  })

  it('ranks a different query to a different chunk', () => {
    const ranked = rankChunks('Tell me about embeddings', chunks, 3)
    expect(ranked[0].id).toBe('c2')
  })

  it('respects the result limit', () => {
    expect(rankChunks('tokenization embeddings context', chunks, 2)).toHaveLength(2)
  })

  it('returns an empty array when nothing matches', () => {
    expect(rankChunks('quantum entanglement photons', chunks, 3)).toEqual([])
  })

  it('returns an empty array for a stopword-only query', () => {
    expect(rankChunks('the and of', chunks, 3)).toEqual([])
  })

  it('scores a chunk matching two query terms above one matching a single term', () => {
    const ranked = rankChunks('tokenization subword', chunks, 3)
    expect(ranked[0].id).toBe('c1')
    expect(ranked[0].score).toBeGreaterThan(0)
  })

  it('handles an empty chunk list', () => {
    expect(rankChunks('tokenization', [], 3)).toEqual([])
  })

  it('attaches a score to every result', () => {
    for (const result of rankChunks('tokenization', chunks, 3)) {
      expect(result.score).toBeGreaterThan(0)
    }
  })
})
