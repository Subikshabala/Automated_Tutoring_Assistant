# B2 — Hybrid Retrieval

**Depends on:** B1 (embeddings exist). **Blocks:** B3.

**Problem:** `rankChunks` is keyword-only. It returns `[]` for any question whose words do not literally appear in the document, and `queryMaterial` then short-circuits before the model is called.

**Decision:** fuse two signals.

| Signal | Catches | Fails on |
|---|---|---|
| Cosine similarity | Paraphrase, vague questions | Exact rare terms, acronyms, numbers |
| Keyword TF-IDF | Literal matches, identifiers | Anything paraphrased |

Neither alone is enough. Fusing them, plus a **document-level fallback** when both score zero, means the model always gets *something* to ground against — and can then honestly say the document does not cover it.

That distinction matters: *"retrieval found nothing"* and *"the document does not answer this"* are different failures, and only the second should be shown to a learner.

---

## Task 1: Shrink the stopword list

**File:** modify `lib/text/retrieve.ts`, test `tests/text/retrieve.test.ts`

The current list eats `summarize`, `tell`, `about`, `how`, `what` — words that carry intent.

- [ ] **Step 1: Add failing cases**

Append to the `tokenize` describe block:

```ts
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
```

Note the last case: the current filter is `length > 1`, so `cia` already survives. It is here to lock that in.

- [ ] **Step 2: Replace the list**

```ts
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
```

Removed: `do`, `does`, `how`, `what`, `when`, `where`, `which`, `who`, `why`, `you`, `your`, `me`, `my`, `about`, `tell`, `can`, `could`, `would`, `should`, and the stray Cyrillic `что`.

- [ ] **Step 3: Tests pass (17), commit**

```bash
git add lib/text/retrieve.ts tests/text/retrieve.test.ts
git commit -m "fix(rag): stop discarding intent-bearing words during tokenization"
```

---

## Task 2: Hybrid scorer

**File:** modify `lib/text/retrieve.ts`, create `tests/text/hybrid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
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
```

Add `beforeAll` to the vitest import.

- [ ] **Step 2: Implement in `lib/text/retrieve.ts`**

```ts
import { cosineSimilarity, embedText } from '@/lib/text/embed'

export type RankedChunk = Chunk & {
  score: number
  keywordScore: number
  semanticScore: number
  /** True when nothing scored above threshold and we returned leading chunks. */
  viaFallback: boolean
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
```

Keep the existing synchronous `rankChunks` export — `hybridRank` builds on it and its tests still pass.

- [ ] **Step 3: Tests pass (12), commit**

```bash
git add lib/text/retrieve.ts tests/text/hybrid.test.ts
git commit -m "feat(rag): add hybrid semantic + keyword retrieval with fallback"
```

---

## Task 3: Wire it into the query service

**Files:** modify `lib/ai/material.ts`, `lib/ai/prompts.ts`, test `tests/ai/material.test.ts`

- [ ] **Step 1: Tell the model when context is weak**

In `lib/ai/prompts.ts`, extend `GroundedRequest`:

```ts
export type GroundedRequest = {
  filename: string
  question: string
  passages: string[]
  /** True when retrieval found no strong match and these are opening chunks. */
  weakMatch?: boolean
}
```

And inside `groundedPrompt`, before the Rules block:

```ts
  const caveat = request.weakMatch
    ? `\nNote: no passage closely matched the question. These are the opening
sections of the document. If they do not answer it, say so plainly.\n`
    : ''
```

Interpolate `${caveat}` after the passages.

- [ ] **Step 2: Rewrite `queryMaterial`**

```ts
import { hybridRank, type RankedChunk } from '@/lib/text/retrieve'

const TOP_K = 4

export async function queryMaterial(
  materialId: string,
  question: string,
): Promise<{ answer: GroundedAnswer; sources: RankedChunk[] }> {
  const material = await findMaterial(materialId)
  if (!material) {
    throw new ApiError('NOT_FOUND', `No material with id "${materialId}"`, 404)
  }
  if (material.status !== 'READY') {
    throw new ApiError(
      'MATERIAL_NOT_READY',
      `This document is ${material.status.toLowerCase()} and cannot be queried yet`,
      409,
    )
  }

  const chunks = await getChunks(materialId)

  if (chunks.length === 0) {
    return {
      answer: {
        answer: 'This document has no readable content to search.',
        foundInMaterial: false,
        quotedPassages: [],
      },
      sources: [],
    }
  }

  const sources = await hybridRank(question, chunks, TOP_K)
  const weakMatch = sources.every((s) => s.viaFallback)

  // Always call the model now. Deciding whether the document answers a
  // question is a judgement, not a similarity threshold.
  const answer = await generateStructured({
    prompt: groundedPrompt({
      filename: material.filename,
      question,
      passages: sources.map((s) => s.content),
      weakMatch,
    }),
    schema: groundedAnswerSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.2,
    schemaName: 'grounded_answer',
  })

  return { answer, sources }
}
```

The `sources.length === 0` early return is gone. That was the bug.

- [ ] **Step 3: Update the service test**

In `tests/ai/material.test.ts`, replace the *"returns a not-found answer without calling the model"* case:

```ts
it('calls the model even when nothing matches strongly', async () => {
  generateStructured.mockResolvedValue({
    answer: 'The document does not cover that.',
    foundInMaterial: false,
    quotedPassages: [],
  })
  const { queryMaterial } = await import('@/lib/ai/material')
  const result = await queryMaterial('m1', 'quantum entanglement photons')
  expect(generateStructured).toHaveBeenCalled()
  expect(result.answer.foundInMaterial).toBe(false)
}, 60_000)

it('flags a weak match in the prompt', async () => {
  generateStructured.mockResolvedValue({
    answer: 'x', foundInMaterial: false, quotedPassages: [],
  })
  const { queryMaterial } = await import('@/lib/ai/material')
  await queryMaterial('m1', 'quantum entanglement photons')
  expect(generateStructured.mock.calls[0][0].prompt).toContain(
    'no passage closely matched',
  )
}, 60_000)

it('answers a vague question instead of refusing', async () => {
  generateStructured.mockResolvedValue({
    answer: 'This document explains tokenization and embeddings.',
    foundInMaterial: true,
    quotedPassages: ['Tokenization splits text into subword units.'],
  })
  const { queryMaterial } = await import('@/lib/ai/material')
  const result = await queryMaterial('m1', 'what is this')
  expect(generateStructured).toHaveBeenCalled()
  expect(result.sources.length).toBeGreaterThan(0)
}, 60_000)

it('returns early only when the document has no chunks', async () => {
  getChunks.mockResolvedValue([])
  const { queryMaterial } = await import('@/lib/ai/material')
  const result = await queryMaterial('m1', 'anything')
  expect(generateStructured).not.toHaveBeenCalled()
  expect(result.answer.foundInMaterial).toBe(false)
})
```

The mocked chunks need `embedding` fields — add them, or let `hybridRank` fall through to keyword-only, which the implementation handles.

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 5: Live smoke test**

```bash
npm run dev
```

Upload `/tmp/test-notes.txt` (or any text file) at `/materials`, open it, then ask:

| Question | Expected |
|---|---|
| "what is this" | A real summary — **this is the case that was broken** |
| "summarize this document" | A real summary |
| An exact term from the doc | Correct answer with the passage quoted |
| "what is the capital of France" | Declines — `foundInMaterial: false` |

The last one is the critical guard. If the model answers "Paris", grounding has failed and the prompt needs tightening.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/material.ts lib/ai/prompts.ts tests/ai/material.test.ts
git commit -m "fix(rag): always consult the model, never short-circuit on retrieval miss

queryMaterial returned 'not covered' whenever keyword retrieval scored
zero, which happened for any paraphrased or vague question. Retrieval now
falls back to opening chunks and flags the weak match, letting the model
judge whether the document answers the question."
```

---

## Exit checklist

- [ ] "what is this" returns a real summary
- [ ] "summarize this document" works
- [ ] An exact rare term still ranks first (keyword signal intact)
- [ ] A paraphrased question finds the right passage (semantic signal works)
- [ ] An off-topic question is declined, not hallucinated
- [ ] Chunks without embeddings degrade to keyword-only
- [ ] All four verification commands pass

Next: [`B3-material-qa-ux.md`](./B3-material-qa-ux.md) surfaces retrieval quality in the UI.
