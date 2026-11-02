# B1 — Local Embeddings

**Depends on:** A1 (provider swap). **Blocks:** B2, B3.

**Problem:** retrieval is pure keyword TF-IDF. Measured against the real tokenizer:

```
"what is this"                → []            ← every word is a stopword
"what is this document about" → ["document"]
"summarize this"              → ["summarize"]
```

`rankChunks` returns `[]`, and `queryMaterial` short-circuits to *"Nothing in this document appears to address that question"* **before the model is ever called**. The user sees a failure that is really a retrieval miss.

Keyword overlap cannot answer "what is this" — the answer shares no literal words with the question. That needs semantic similarity.

**Decision:** embed locally with `@xenova/transformers`. Runs `all-MiniLM-L6-v2` in-process via ONNX. One ~25 MB download on first use, then no network, no key, no rate limit, no data leaving the machine. ~50 ms per query after a ~2 s cold start.

The alternative — an embedding API — reintroduces exactly the rate limit the user is trying to escape.

---

## Task 1: Install and gitignore the model cache

- [ ] **Step 1: Install**

```bash
npm install @xenova/transformers
```

- [ ] **Step 2: Ignore the cache**

Append to `.gitignore`:

```
# Transformers.js model cache (~25MB, downloaded on first embed)
/.cache/transformers
```

- [ ] **Step 3: Allow the ONNX binary through Turbopack**

`onnxruntime-node` ships a native `.node` binary that must not be bundled. In `next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
}

export default nextConfig
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore next.config.ts
git commit -m "chore(rag): add @xenova/transformers for local embeddings"
```

---

## Task 2: The embedder

**Files:** create `lib/text/embed.ts`, test `tests/text/embed.test.ts`

Model load is expensive, so the pipeline is cached on `globalThis` — same reasoning as the Prisma singleton, and it survives dev hot reloads.

- [ ] **Step 1: Write the failing test**

These hit the real model. The first run downloads it, so allow a generous timeout.

```ts
import { describe, expect, it } from 'vitest'
import {
  cosineSimilarity,
  embedBatch,
  embedText,
  EMBEDDING_DIM,
} from '@/lib/text/embed'

describe('embedText', () => {
  it('returns a fixed-length vector', async () => {
    const v = await embedText('Tokenization splits text into subword units.')
    expect(v).toHaveLength(EMBEDDING_DIM)
  }, 120_000)

  it('returns a normalised vector', async () => {
    const v = await embedText('hello world')
    const magnitude = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    expect(magnitude).toBeCloseTo(1, 4)
  }, 60_000)

  it('is deterministic', async () => {
    const a = await embedText('same input')
    const b = await embedText('same input')
    expect(a).toEqual(b)
  }, 60_000)

  it('throws on empty input', async () => {
    await expect(embedText('   ')).rejects.toThrow(/empty/i)
  })
})

describe('embedBatch', () => {
  it('returns one vector per input', async () => {
    const vs = await embedBatch(['first text', 'second text', 'third text'])
    expect(vs).toHaveLength(3)
    expect(vs[0]).toHaveLength(EMBEDDING_DIM)
  }, 60_000)

  it('returns an empty array for no input', async () => {
    await expect(embedBatch([])).resolves.toEqual([])
  })

  it('matches embedText for the same string', async () => {
    const [batched] = await embedBatch(['consistency check'])
    const single = await embedText('consistency check')
    expect(batched).toEqual(single)
  }, 60_000)
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 for a zero vector rather than NaN', () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0)
  })

  it('returns 0 on a length mismatch', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0)
  })
})

describe('semantic behaviour', () => {
  it('scores related sentences above unrelated ones', async () => {
    const query = await embedText('How does a model turn text into numbers?')
    const related = await embedText(
      'Tokenization splits raw text into subword units the model maps to ids.',
    )
    const unrelated = await embedText(
      'The CIA triad covers confidentiality, integrity and availability.',
    )
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated),
    )
  }, 60_000)

  it('matches a vague question to document-level content', async () => {
    // The exact case keyword search fails on.
    const query = await embedText('what is this')
    const content = await embedText(
      'This document explains how to install and configure OpenCode on Windows 11.',
    )
    expect(cosineSimilarity(query, content)).toBeGreaterThan(0.1)
  }, 60_000)
})
```

- [ ] **Step 2: Run it — expect module-not-found**

```bash
npx vitest run tests/text/embed.test.ts --fileParallelism=false
```

- [ ] **Step 3: Create `lib/text/embed.ts`**

```ts
import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

/** all-MiniLM-L6-v2 output dimensionality. */
export const EMBEDDING_DIM = 384

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

// Keep weights out of node_modules and out of git.
env.cacheDir = './.cache/transformers'
env.allowRemoteModels = true

type Cache = { embedder: Promise<FeatureExtractionPipeline> | undefined }
const globalForEmbed = globalThis as unknown as Cache

/**
 * Loads once per process. The promise itself is cached so concurrent
 * callers during the ~2s cold start share a single load.
 */
function getEmbedder(): Promise<FeatureExtractionPipeline> {
  globalForEmbed.embedder ??= pipeline('feature-extraction', MODEL_ID, {
    quantized: true,
  }) as Promise<FeatureExtractionPipeline>
  return globalForEmbed.embedder
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    throw new Error('Cannot embed empty text')
  }

  const embedder = await getEmbedder()
  const output = await embedder(trimmed, {
    pooling: 'mean',
    normalize: true,
  })

  return Array.from(output.data as Float32Array)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const embedder = await getEmbedder()
  const output = await embedder(
    texts.map((t) => t.trim()),
    { pooling: 'mean', normalize: true },
  )

  // Batched output is a flat [n * dim] Float32Array.
  const flat = output.data as Float32Array
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i++) {
    vectors.push(
      Array.from(flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM)),
    )
  }
  return vectors
}

/** Vectors are pre-normalised, so this is effectively a dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/text/embed.test.ts --fileParallelism=false
```

First run downloads ~25 MB. Expect 14 passed.

If it fails with `Cannot find module 'onnxruntime-node'`, install it explicitly: `npm install onnxruntime-node`.

- [ ] **Step 5: Commit**

```bash
git add lib/text/embed.ts tests/text/embed.test.ts
git commit -m "feat(rag): add local sentence embeddings via transformers.js"
```

---

## Task 3: Persist vectors

**Files:** modify `prisma/schema.prisma`, `lib/repositories/material.ts`

SQLite has no vector type. Store JSON text and compare in memory — fine at this corpus size, where a document is tens of chunks, not millions.

- [ ] **Step 1: Add the column**

In `model MaterialChunk`:

```prisma
model MaterialChunk {
  id         String @id @default(cuid())
  materialId String
  content    String
  tokenCount Int    @default(0)
  order      Int

  /// JSON-encoded number[384] from all-MiniLM-L6-v2. Empty until embedded.
  embedding  String @default("")

  material Material @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@unique([materialId, order])
  @@index([materialId])
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name add_chunk_embedding
```

- [ ] **Step 3: Embed on store**

In `lib/repositories/material.ts`, rewrite `storeChunks`:

```ts
import { embedBatch } from '@/lib/text/embed'

export async function storeChunks(
  materialId: string,
  contents: string[],
): Promise<void> {
  // Embedding failure must not lose the document — keyword search still
  // works without vectors, so degrade instead of throwing.
  let vectors: number[][] = []
  try {
    vectors = await embedBatch(contents)
  } catch (error) {
    console.error('Embedding failed, storing chunks without vectors:', error)
  }

  await prisma.$transaction([
    prisma.materialChunk.deleteMany({ where: { materialId } }),
    prisma.materialChunk.createMany({
      data: contents.map((content, order) => ({
        materialId,
        content,
        order,
        tokenCount: Math.ceil(content.length / 4),
        embedding: vectors[order] ? JSON.stringify(vectors[order]) : '',
      })),
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { status: 'READY', error: null },
    }),
  ])
}
```

- [ ] **Step 4: Expose vectors on read**

Extend the `Chunk` type in `lib/text/retrieve.ts`:

```ts
export type Chunk = {
  id: string
  content: string
  order: number
  /** Empty when the chunk predates embedding or embedding failed. */
  embedding?: number[]
}
```

Then in `getChunks`:

```ts
export async function getChunks(materialId: string): Promise<Chunk[]> {
  const rows = await prisma.materialChunk.findMany({
    where: { materialId },
    orderBy: { order: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    order: row.order,
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
  }))
}
```

- [ ] **Step 5: Add repository tests**

Append to `tests/repositories/material.test.ts`:

```ts
describe('storeChunks embeddings', () => {
  it('stores a vector per chunk', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['first chunk text', 'second chunk text'])
    const chunks = await getChunks(material.id)
    expect(chunks[0].embedding).toHaveLength(384)
    expect(chunks[1].embedding).toHaveLength(384)
  }, 120_000)

  it('gives different content different vectors', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, [
      'Tokenization splits text into subwords.',
      'The CIA triad is confidentiality, integrity, availability.',
    ])
    const chunks = await getChunks(material.id)
    expect(chunks[0].embedding).not.toEqual(chunks[1].embedding)
  }, 120_000)
})
```

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck
npm test -- --fileParallelism=false
git add -A
git commit -m "feat(rag): persist chunk embeddings on upload"
```

---

## Task 4: Backfill existing material

**File:** create `scripts/backfill-embeddings.ts`

Documents uploaded before this change have no vectors.

- [ ] **Step 1: Write the script**

Mirror the Prisma adapter setup from `prisma/seed.ts`.

```ts
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { embedBatch } from '../lib/text/embed'
import path from 'node:path'

const adapter = new PrismaLibSQL({
  url: `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`,
})
const prisma = new PrismaClient({ adapter })

const BATCH = 16

async function main() {
  const pending = await prisma.materialChunk.findMany({
    where: { embedding: '' },
    select: { id: true, content: true },
  })

  if (pending.length === 0) {
    console.log('Every chunk already has an embedding.')
    return
  }

  console.log(`Embedding ${pending.length} chunks...`)

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH)
    const vectors = await embedBatch(slice.map((c) => c.content))

    await prisma.$transaction(
      slice.map((chunk, j) =>
        prisma.materialChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(vectors[j]) },
        }),
      ),
    )

    console.log(`  ${Math.min(i + BATCH, pending.length)}/${pending.length}`)
  }

  console.log('Done.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

- [ ] **Step 2: Add the npm script**

In `package.json`:

```json
"db:embed": "tsx scripts/backfill-embeddings.ts"
```

- [ ] **Step 3: Run it**

```bash
npm run db:embed
```

Expected: either `Every chunk already has an embedding.` or progress lines ending in `Done.`

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-embeddings.ts package.json
git commit -m "feat(rag): add embedding backfill script"
```

---

## Exit checklist

- [ ] `npm run db:embed` completes
- [ ] A fresh upload stores 384-length vectors for every chunk
- [ ] An embedding failure leaves the material `READY` with empty vectors, not `FAILED`
- [ ] `cosineSimilarity` scores a related sentence above an unrelated one
- [ ] `.cache/transformers` is gitignored
- [ ] All four verification commands pass

Next: [`B2-hybrid-retrieval.md`](./B2-hybrid-retrieval.md) uses these vectors to actually fix search.
