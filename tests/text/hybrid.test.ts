// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { embedText } from '@/lib/text/embed'
import { hybridRank, type Chunk } from '@/lib/text/retrieve'

async function chunk(id: string, content: string, order: number): Promise<Chunk> {
  return { id, content, order, embedding: await embedText(content) }
}

let chunks: Chunk[]

beforeAll(async () => {
  chunks = await Promise.all([
    chunk('c1', 'Tokenization splits raw text into subword units from a fixed vocabulary.', 0),
    chunk('c2', 'Embeddings are dense vectors where geometric closeness encodes meaning.', 1),
    chunk('c3', 'Install OpenCode on Windows 11 by running the setup script as administrator.', 2),
  ])
}, 120_000)

describe('hybridRank keyword strength', () => {
  it('finds an exact term match', async () => {
    const r = await hybridRank('tokenization', chunks, 3)
    expect(r[0].id).toBe('c1')
  }, 30_000)

  it('finds a rare literal term', async () => {
    const r = await hybridRank('Windows 11', chunks, 3)
    expect(r[0].id).toBe('c3')
  }, 30_000)
})

describe('hybridRank semantic strength', () => {
  it('answers a paraphrased question with no shared words', async () => {
    const r = await hybridRank('how does a model turn words into numbers', chunks, 3)
    expect(['c1', 'c2']).toContain(r[0].id)
  }, 30_000)

  it('answers a vague question instead of returning nothing', async () => {
    const r = await hybridRank('what is this', chunks, 3)
    expect(r.length).toBeGreaterThan(0)
  }, 30_000)

  it('answers a summarise request', async () => {
    const r = await hybridRank('summarize this document', chunks, 3)
    expect(r.length).toBeGreaterThan(0)
  }, 30_000)
})

describe('hybridRank mechanics', () => {
  it('respects the limit', async () => {
    expect(await hybridRank('text model install', chunks, 2)).toHaveLength(2)
  }, 30_000)

  it('sorts by descending score', async () => {
    const r = await hybridRank('tokenization embeddings', chunks, 3)
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score)
    }
  }, 30_000)

  it('reports both component scores', async () => {
    const r = await hybridRank('tokenization', chunks, 1)
    expect(r[0].keywordScore).toBeGreaterThan(0)
    expect(typeof r[0].semanticScore).toBe('number')
  }, 30_000)

  it('handles chunks with no embedding', async () => {
    const mixed = [...chunks, { id: 'c4', content: 'tokenization again', order: 3 }]
    const r = await hybridRank('tokenization', mixed, 4)
    expect(r.some((c) => c.id === 'c4')).toBe(true)
  }, 30_000)

  it('returns an empty array for no chunks', async () => {
    expect(await hybridRank('anything', [], 3)).toEqual([])
  })

  it('still returns results for an unrelated query via fallback', async () => {
    const r = await hybridRank('quantum entanglement photons', chunks, 2)
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].viaFallback).toBe(true)
  }, 30_000)

  it('does not mark genuine matches as fallback', async () => {
    const r = await hybridRank('tokenization', chunks, 1)
    expect(r[0].viaFallback).toBe(false)
  }, 30_000)
})
