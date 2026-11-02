import { cosineSimilarity, embedText } from '@/lib/text/embed'

/**
 * Function words only. Anything that narrows meaning — verbs like
 * "summarize", nouns like "document" — must survive, because the keyword
 * signal is the only one that catches rare literal terms.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being',
  'but', 'by', 'for', 'from', 'had', 'has', 'have', 'in', 'into',
  'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their',
  'them', 'there', 'these', 'they', 'this', 'to', 'was', 'were',
  'will', 'with',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term))
}

export type Chunk = {
  id: string
  content: string
  order: number
  /** Empty when the chunk predates embedding or embedding failed. */
  embedding?: number[]
}

export type RankedChunk = Chunk & {
  score: number
  keywordScore: number
  semanticScore: number
  /** True when nothing scored above threshold and we returned leading chunks. */
  viaFallback: boolean
}

/**
 * TF-IDF-ish scoring: term frequency in the chunk, weighted by how rare
 * the term is across the corpus, normalised by chunk length.
 */
export function rankChunks(
  query: string,
  chunks: Chunk[],
  limit: number,
): RankedChunk[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0 || chunks.length === 0) return []

  const chunkTerms = chunks.map((chunk) => tokenize(chunk.content))

  const documentFrequency = new Map<string, number>()
  for (const term of new Set(queryTerms)) {
    const count = chunkTerms.filter((terms) => terms.includes(term)).length
    documentFrequency.set(term, count)
  }

  const scored: RankedChunk[] = chunks.map((chunk, index) => {
    const terms = chunkTerms[index]
    if (terms.length === 0) {
      return { ...chunk, score: 0, keywordScore: 0, semanticScore: 0, viaFallback: false }
    }

    let score = 0
    for (const queryTerm of queryTerms) {
      const termFrequency = terms.filter((t) => t === queryTerm).length
      if (termFrequency === 0) continue

      const df = documentFrequency.get(queryTerm) ?? 1
      const idf = Math.log(1 + chunks.length / df)
      score += (termFrequency / terms.length) * idf
    }

    return { ...chunk, score, keywordScore: score, semanticScore: 0, viaFallback: false }
  })

  return scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Semantic dominates because paraphrase is the common case. */
const SEMANTIC_WEIGHT = 0.7
const KEYWORD_WEIGHT = 0.3

/** Below this, treat the corpus as having no real match. */
const RELEVANCE_FLOOR = 0.12

/**
 * Fuses cosine similarity with keyword TF-IDF.
 *
 * When nothing clears RELEVANCE_FLOOR, returns the leading chunks flagged
 * `viaFallback` rather than an empty array. The model can then read actual
 * document content and decide whether it answers the question — which is a
 * judgement it makes far better than a similarity threshold.
 */
export async function hybridRank(
  query: string,
  chunks: Chunk[],
  limit: number,
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return []

  const keyword = rankChunks(query, chunks, chunks.length)
  const keywordById = new Map(keyword.map((c) => [c.id, c.score]))
  const maxKeyword = Math.max(1e-6, ...keyword.map((c) => c.score))

  let queryVector: number[] | null = null
  try {
    queryVector = await embedText(query)
  } catch (error) {
    console.error('Query embedding failed, keyword only:', error)
  }

  const scored: RankedChunk[] = chunks.map((chunk) => {
    const keywordScore = (keywordById.get(chunk.id) ?? 0) / maxKeyword

    const semanticScore =
      queryVector && chunk.embedding
        ? Math.max(0, cosineSimilarity(queryVector, chunk.embedding))
        : 0

    // Reweight when one signal is unavailable so scores stay comparable.
    const score =
      queryVector && chunk.embedding
        ? semanticScore * SEMANTIC_WEIGHT + keywordScore * KEYWORD_WEIGHT
        : keywordScore

    return { ...chunk, score, keywordScore, semanticScore, viaFallback: false }
  })

  const ordered = scored.sort((a, b) => b.score - a.score)
  const relevant = ordered.filter((c) => c.score >= RELEVANCE_FLOOR)

  if (relevant.length > 0) {
    return relevant.slice(0, limit)
  }

  // Nothing matched. Hand the model the opening chunks — they usually carry
  // the title and introduction, which is exactly what "what is this" needs.
  return ordered
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.min(limit, 3))
    .map((c) => ({ ...c, viaFallback: true }))
}
