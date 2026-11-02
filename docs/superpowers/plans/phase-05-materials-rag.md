# Phase 5 — Materials & RAG

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner uploads a PDF or TXT file, the platform extracts and chunks the text, and the learner can then ask questions answered strictly from their own material, with the supporting passages shown alongside the answer.

**Architecture:** Upload → extract → chunk → store. Retrieval is keyword-based TF-IDF-style scoring over stored chunks — no vector database, no embedding service. This is a deliberate simplification: it is fully deterministic, trivially testable, and good enough at this corpus size. The retrieved chunks become the only grounding the model is allowed to use, and the answer schema forces it to declare when the material does not cover the question.

**Tech Stack:** `pdf-parse` · Gemini · Zod · Prisma · Next.js Route Handlers · shadcn/ui

**Depends on:** Phase 3 complete (Gemini client exists).

**Done when:** `/materials` accepts an upload, shows processing status, and `/materials/<id>` answers questions from that document with cited passages.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/schemas/material.ts` | Material and RAG answer contracts |
| `lib/text/extract.ts` | PDF/TXT → plain text |
| `lib/text/chunk.ts` | Pure text → overlapping chunks |
| `lib/text/retrieve.ts` | Pure keyword scoring and ranking |
| `lib/repositories/material.ts` | Material + chunk persistence |
| `lib/ai/material.ts` | Grounded question answering |
| `app/api/materials/route.ts` | `POST` upload, `GET` list |
| `app/api/materials/[id]/route.ts` | `GET` one material, `DELETE` it |
| `app/api/materials/[id]/query/route.ts` | `POST` ask a question |
| `components/material-upload.tsx` | Drag-and-drop upload (client) |
| `components/material-list.tsx` | Uploaded documents list |
| `components/material-qa.tsx` | Question panel with sources |
| `app/materials/page.tsx` | Materials index |
| `app/materials/[id]/page.tsx` | Single material + Q&A |

---

## Task 1: Material schemas

**Files:**
- Create: `lib/schemas/material.ts`
- Test: `tests/lib/schemas-material.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-material.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  groundedAnswerSchema,
  materialQuerySchema,
  materialSummarySchema,
} from '@/lib/schemas/material'

describe('materialSummarySchema', () => {
  const material = {
    id: 'm1',
    filename: 'notes.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12345,
    status: 'READY' as const,
    chunkCount: 12,
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well formed material', () => {
    expect(materialSummarySchema.parse(material).filename).toBe('notes.pdf')
  })

  it('accepts every valid status', () => {
    for (const status of ['UPLOADED', 'PROCESSING', 'READY', 'FAILED']) {
      expect(
        materialSummarySchema.safeParse({ ...material, status }).success,
      ).toBe(true)
    }
  })

  it('rejects an unknown status', () => {
    expect(
      materialSummarySchema.safeParse({ ...material, status: 'WEIRD' }).success,
    ).toBe(false)
  })

  it('allows an error string on a failed material', () => {
    const parsed = materialSummarySchema.parse({
      ...material,
      status: 'FAILED',
      error: 'Could not read the PDF',
    })
    expect(parsed.error).toBe('Could not read the PDF')
  })
})

describe('materialQuerySchema', () => {
  it('accepts a question', () => {
    expect(materialQuerySchema.parse({ question: 'What is X?' }).question).toBe(
      'What is X?',
    )
  })

  it('rejects an empty question', () => {
    expect(materialQuerySchema.safeParse({ question: '' }).success).toBe(false)
  })

  it('rejects a question over 500 characters', () => {
    expect(
      materialQuerySchema.safeParse({ question: 'a'.repeat(501) }).success,
    ).toBe(false)
  })
})

describe('groundedAnswerSchema', () => {
  const answer = {
    answer: 'The document defines X as Y.',
    foundInMaterial: true,
    quotedPassages: ['X is defined as Y.'],
  }

  it('accepts a well formed grounded answer', () => {
    expect(groundedAnswerSchema.parse(answer).foundInMaterial).toBe(true)
  })

  it('allows foundInMaterial to be false', () => {
    const parsed = groundedAnswerSchema.parse({
      answer: 'The document does not cover this.',
      foundInMaterial: false,
      quotedPassages: [],
    })
    expect(parsed.foundInMaterial).toBe(false)
  })

  it('defaults quotedPassages to an empty array', () => {
    const { quotedPassages: _omitted, ...rest } = answer
    expect(groundedAnswerSchema.parse(rest).quotedPassages).toEqual([])
  })

  it('rejects an empty answer', () => {
    expect(
      groundedAnswerSchema.safeParse({ ...answer, answer: '' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-material.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/material'`.

- [ ] **Step 3: Create `lib/schemas/material.ts`**

```ts
import { z } from 'zod'
import { idSchema } from './common'

export const materialStatusSchema = z.enum([
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
])

export const materialSummarySchema = z.object({
  id: idSchema,
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  status: materialStatusSchema,
  chunkCount: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.string(),
})

export const materialQuerySchema = z.object({
  question: z.string().min(1).max(500),
})

export const groundedAnswerSchema = z.object({
  answer: z.string().min(1),
  foundInMaterial: z.boolean(),
  quotedPassages: z.array(z.string()).default([]),
})

export type MaterialStatus = z.infer<typeof materialStatusSchema>
export type MaterialSummary = z.infer<typeof materialSummarySchema>
export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-material.test.ts`
Expected: PASS — `11 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/material.ts tests/lib/schemas-material.test.ts
git commit -m "feat(materials): add zod contracts for material and grounded answer"
```

---

## Task 2: Text chunking

Pure function. Chunk boundaries materially affect retrieval quality, so this is worth testing carefully.

**Files:**
- Create: `lib/text/chunk.ts`
- Test: `tests/text/chunk.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/text/chunk.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chunkText, cleanText } from '@/lib/text/chunk'

describe('cleanText', () => {
  it('collapses runs of whitespace', () => {
    expect(cleanText('a    b\t\tc')).toBe('a b c')
  })

  it('collapses more than two consecutive newlines into two', () => {
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('strips leading and trailing whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello')
  })

  it('removes null bytes left by some pdf extractors', () => {
    expect(cleanText('a\u0000b')).toBe('ab')
  })
})

describe('chunkText', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkText('', 100, 20)).toEqual([])
  })

  it('returns a single chunk when the text is short', () => {
    const chunks = chunkText('short text', 100, 20)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('short text')
  })

  it('splits long text into several chunks', () => {
    const text = 'word '.repeat(200).trim()
    const chunks = chunkText(text, 200, 40)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('keeps every chunk within the size limit plus a word of slack', () => {
    const text = 'word '.repeat(200).trim()
    for (const chunk of chunkText(text, 200, 40)) {
      expect(chunk.length).toBeLessThanOrEqual(205)
    }
  })

  it('overlaps consecutive chunks', () => {
    const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ')
    const chunks = chunkText(text, 120, 40)
    const firstTail = chunks[0].slice(-30)
    expect(chunks[1]).toContain(firstTail.trim().split(' ')[1])
  })

  it('does not split in the middle of a word', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india'
    for (const chunk of chunkText(text, 20, 5)) {
      expect(chunk.trim()).not.toMatch(/^\S*?[a-z]$|^[a-z]\S*?$/)
      for (const word of chunk.split(' ')) {
        expect(text).toContain(word)
      }
    }
  })

  it('produces no empty chunks', () => {
    const text = 'word '.repeat(200).trim()
    for (const chunk of chunkText(text, 200, 40)) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('terminates when overlap is as large as the chunk size', () => {
    const text = 'word '.repeat(100).trim()
    const chunks = chunkText(text, 50, 50)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.length).toBeLessThan(1000)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/text/chunk.test.ts`
Expected: FAIL — `Cannot find module '@/lib/text/chunk'`.

- [ ] **Step 3: Create `lib/text/chunk.ts`**

```ts
export const DEFAULT_CHUNK_SIZE = 1200
export const DEFAULT_OVERLAP = 200

export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

/**
 * Splits text into word-aligned chunks of at most `size` characters,
 * with `overlap` characters of context repeated between neighbours.
 */
export function chunkText(
  text: string,
  size: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  const cleaned = cleanText(text)
  if (cleaned.length === 0) return []
  if (cleaned.length <= size) return [cleaned]

  // Guarantee forward progress even if the caller passes overlap >= size.
  const step = Math.max(1, size - Math.min(overlap, size - 1))

  const words = cleaned.split(' ')
  const chunks: string[] = []

  let current: string[] = []
  let currentLength = 0

  for (const word of words) {
    const addedLength = currentLength === 0 ? word.length : currentLength + 1 + word.length

    if (addedLength > size && current.length > 0) {
      chunks.push(current.join(' '))

      // Rebuild the tail of the previous chunk as the head of the next one.
      const tail: string[] = []
      let tailLength = 0
      for (let i = current.length - 1; i >= 0; i--) {
        const next = tailLength === 0 ? current[i].length : tailLength + 1 + current[i].length
        if (next > size - step) break
        tail.unshift(current[i])
        tailLength = next
      }

      current = [...tail, word]
      currentLength = tail.join(' ').length + (tail.length > 0 ? 1 : 0) + word.length
    } else {
      current.push(word)
      currentLength = addedLength
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' '))
  }

  return chunks.filter((c) => c.trim().length > 0)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/text/chunk.test.ts`
Expected: PASS — `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/text/chunk.ts tests/text/chunk.test.ts
git commit -m "feat(materials): add pure text cleaning and overlapping chunker"
```

---

## Task 3: Keyword retrieval

Also pure. Deliberately simple: no embeddings, no external service.

**Files:**
- Create: `lib/text/retrieve.ts`
- Test: `tests/text/retrieve.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/text/retrieve.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/text/retrieve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/text/retrieve.ts`**

```ts
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does',
  'for', 'from', 'has', 'have', 'how', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'что', 'that', 'the', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'to', 'was', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'you', 'your', 'me', 'my', 'about',
  'tell', 'can', 'could', 'would', 'should',
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
}

export type RankedChunk = Chunk & { score: number }

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
    if (terms.length === 0) return { ...chunk, score: 0 }

    let score = 0
    for (const queryTerm of queryTerms) {
      const termFrequency = terms.filter((t) => t === queryTerm).length
      if (termFrequency === 0) continue

      const df = documentFrequency.get(queryTerm) ?? 1
      const idf = Math.log(1 + chunks.length / df)
      score += (termFrequency / terms.length) * idf
    }

    return { ...chunk, score }
  })

  return scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/text/retrieve.test.ts`
Expected: PASS — `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/text/retrieve.ts tests/text/retrieve.test.ts
git commit -m "feat(materials): add pure keyword chunk retrieval"
```

---

## Task 4: Text extraction

**Files:**
- Create: `lib/text/extract.ts`
- Test: `tests/text/extract.test.ts`

- [ ] **Step 1: Install the PDF parser**

Run: `npm install pdf-parse && npm install -D @types/pdf-parse`

- [ ] **Step 2: Write the failing test**

Create `tests/text/extract.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfParse = vi.fn()
vi.mock('pdf-parse', () => ({ default: pdfParse }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractText', () => {
  it('decodes a plain text file', async () => {
    const { extractText } = await import('@/lib/text/extract')
    const buffer = Buffer.from('hello world', 'utf-8')
    await expect(extractText(buffer, 'text/plain')).resolves.toBe('hello world')
  })

  it('decodes a markdown file as text', async () => {
    const { extractText } = await import('@/lib/text/extract')
    const buffer = Buffer.from('# Title', 'utf-8')
    await expect(extractText(buffer, 'text/markdown')).resolves.toBe('# Title')
  })

  it('extracts text from a pdf', async () => {
    pdfParse.mockResolvedValue({ text: 'pdf content here' })
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('fake'), 'application/pdf'),
    ).resolves.toBe('pdf content here')
  })

  it('throws UNSUPPORTED_TYPE for an image', async () => {
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'image/png'),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' })
  })

  it('throws EXTRACTION_FAILED when the pdf parser throws', async () => {
    pdfParse.mockRejectedValue(new Error('corrupt'))
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })

  it('throws EXTRACTION_FAILED when the pdf yields no text', async () => {
    pdfParse.mockResolvedValue({ text: '   ' })
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })

  it('throws EXTRACTION_FAILED for an empty text file', async () => {
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('   '), 'text/plain'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })
})

describe('isSupportedType', () => {
  it('accepts pdf, plain text and markdown', async () => {
    const { isSupportedType } = await import('@/lib/text/extract')
    expect(isSupportedType('application/pdf')).toBe(true)
    expect(isSupportedType('text/plain')).toBe(true)
    expect(isSupportedType('text/markdown')).toBe(true)
  })

  it('rejects anything else', async () => {
    const { isSupportedType } = await import('@/lib/text/extract')
    expect(isSupportedType('image/png')).toBe(false)
    expect(isSupportedType('application/zip')).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test tests/text/extract.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `lib/text/extract.ts`**

```ts
import { ApiError } from '@/lib/api'

export const SUPPORTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export function isSupportedType(mimeType: string): boolean {
  return (SUPPORTED_TYPES as readonly string[]).includes(mimeType)
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (!isSupportedType(mimeType)) {
    throw new ApiError(
      'UNSUPPORTED_TYPE',
      'Only PDF, plain text and markdown files are supported',
      400,
    )
  }

  let text: string

  if (mimeType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)
      text = parsed.text
    } catch (error) {
      console.error('PDF extraction failed:', error)
      throw new ApiError(
        'EXTRACTION_FAILED',
        'Could not read text from this PDF. It may be scanned images rather than text.',
        422,
      )
    }
  } else {
    text = buffer.toString('utf-8')
  }

  if (text.trim().length === 0) {
    throw new ApiError(
      'EXTRACTION_FAILED',
      'No readable text was found in this file',
      422,
    )
  }

  return text
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/text/extract.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/text/extract.ts tests/text/extract.test.ts package.json package-lock.json
git commit -m "feat(materials): add pdf and text extraction"
```

---

## Task 5: Material repository

**Files:**
- Create: `lib/repositories/material.ts`
- Test: `tests/repositories/material.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/material.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { ensureDemoUser } from '@/lib/repositories/assessment'
import {
  createMaterial,
  deleteMaterial,
  findMaterial,
  getChunks,
  listMaterials,
  markFailed,
  storeChunks,
} from '@/lib/repositories/material'

afterEach(async () => {
  const user = await ensureDemoUser()
  await prisma.material.deleteMany({ where: { userId: user.id } })
})

async function newMaterial() {
  const user = await ensureDemoUser()
  return createMaterial({
    userId: user.id,
    filename: 'notes.txt',
    mimeType: 'text/plain',
    sizeBytes: 100,
  })
}

describe('createMaterial', () => {
  it('creates a material in UPLOADED status', async () => {
    const material = await newMaterial()
    expect(material.status).toBe('UPLOADED')
    expect(material.chunkCount).toBe(0)
  })
})

describe('storeChunks', () => {
  it('stores chunks and flips the material to READY', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['first chunk', 'second chunk'])
    const updated = await findMaterial(material.id)
    expect(updated!.status).toBe('READY')
    expect(updated!.chunkCount).toBe(2)
  })

  it('preserves chunk order', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['alpha', 'bravo', 'charlie'])
    const chunks = await getChunks(material.id)
    expect(chunks.map((c) => c.content)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('replaces previous chunks rather than appending', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['old'])
    await storeChunks(material.id, ['new one', 'new two'])
    const chunks = await getChunks(material.id)
    expect(chunks.map((c) => c.content)).toEqual(['new one', 'new two'])
  })
})

describe('markFailed', () => {
  it('sets the status to FAILED with the reason', async () => {
    const material = await newMaterial()
    await markFailed(material.id, 'Could not read the PDF')
    const updated = await findMaterial(material.id)
    expect(updated!.status).toBe('FAILED')
    expect(updated!.error).toBe('Could not read the PDF')
  })
})

describe('listMaterials', () => {
  it('returns the learner materials newest first', async () => {
    const user = await ensureDemoUser()
    await createMaterial({ userId: user.id, filename: 'a.txt', mimeType: 'text/plain', sizeBytes: 1 })
    await createMaterial({ userId: user.id, filename: 'b.txt', mimeType: 'text/plain', sizeBytes: 1 })
    const materials = await listMaterials(user.id)
    expect(materials).toHaveLength(2)
    expect(materials[0].filename).toBe('b.txt')
  })

  it('returns an empty array for a learner with no materials', async () => {
    await expect(listMaterials('no-such-user')).resolves.toEqual([])
  })
})

describe('findMaterial', () => {
  it('returns null for an unknown id', async () => {
    await expect(findMaterial('nope')).resolves.toBeNull()
  })
})

describe('deleteMaterial', () => {
  it('removes the material and its chunks', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['a', 'b'])
    await deleteMaterial(material.id)
    expect(await findMaterial(material.id)).toBeNull()
    expect(await getChunks(material.id)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/material.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/material.ts`**

```ts
import prisma from '@/lib/prisma'
import type { MaterialSummary } from '@/lib/schemas/material'
import type { Chunk } from '@/lib/text/retrieve'

function toSummary(row: {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  status: string
  error: string | null
  createdAt: Date
  _count: { chunks: number }
}): MaterialSummary {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status as MaterialSummary['status'],
    chunkCount: row._count.chunks,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createMaterial(input: {
  userId: string
  filename: string
  mimeType: string
  sizeBytes: number
  courseId?: string | null
}): Promise<MaterialSummary> {
  const row = await prisma.material.create({
    data: {
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      courseId: input.courseId ?? null,
      status: 'UPLOADED',
    },
    include: { _count: { select: { chunks: true } } },
  })
  return toSummary(row)
}

export async function storeChunks(
  materialId: string,
  contents: string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.materialChunk.deleteMany({ where: { materialId } }),
    prisma.materialChunk.createMany({
      data: contents.map((content, order) => ({
        materialId,
        content,
        order,
        tokenCount: Math.ceil(content.length / 4),
      })),
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { status: 'READY', error: null },
    }),
  ])
}

export async function markFailed(
  materialId: string,
  reason: string,
): Promise<void> {
  await prisma.material.update({
    where: { id: materialId },
    data: { status: 'FAILED', error: reason },
  })
}

export async function findMaterial(
  id: string,
): Promise<MaterialSummary | null> {
  const row = await prisma.material.findUnique({
    where: { id },
    include: { _count: { select: { chunks: true } } },
  })
  return row ? toSummary(row) : null
}

export async function listMaterials(
  userId: string,
): Promise<MaterialSummary[]> {
  const rows = await prisma.material.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  })
  return rows.map(toSummary)
}

export async function getChunks(materialId: string): Promise<Chunk[]> {
  const rows = await prisma.materialChunk.findMany({
    where: { materialId },
    orderBy: { order: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    order: row.order,
  }))
}

export async function deleteMaterial(id: string): Promise<void> {
  await prisma.material.delete({ where: { id } })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/material.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/material.ts tests/repositories/material.test.ts
git commit -m "feat(materials): add material and chunk repository"
```

---

## Task 6: Grounded answering

**Files:**
- Modify: `lib/ai/prompts.ts`
- Create: `lib/ai/material.ts`
- Test: `tests/ai/material.test.ts`

- [ ] **Step 1: Append the prompt to `lib/ai/prompts.ts`**

```ts
export type GroundedRequest = {
  filename: string
  question: string
  passages: string[]
}

export function groundedPrompt(request: GroundedRequest): string {
  const passages = request.passages
    .map((passage, index) => `[${index + 1}] ${passage}`)
    .join('\n\n')

  return `Answer a question using ONLY the passages below, taken from the learner's own document "${request.filename}".

Passages:
${passages}

Question: ${request.question}

Rules:
- If the passages answer the question, answer from them and set foundInMaterial to true.
- If the passages do not contain the answer, say so plainly and set foundInMaterial to false. Do not fill the gap from general knowledge.
- Quote the exact sentences you relied on. Do not paraphrase inside quotedPassages.

Return JSON:
{
  "answer": "your answer in 2-5 sentences",
  "foundInMaterial": true | false,
  "quotedPassages": ["exact sentences copied from the passages above"]
}`
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/ai/material.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
const getChunks = vi.fn()
const findMaterial = vi.fn()

vi.mock('@/lib/ai/gemini', () => ({ generateStructured }))
vi.mock('@/lib/repositories/material', () => ({ getChunks, findMaterial }))

const chunks = [
  { id: 'c1', content: 'Tokenization splits text into subword units.', order: 0 },
  { id: 'c2', content: 'Embeddings encode semantic similarity as vectors.', order: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  findMaterial.mockResolvedValue({
    id: 'm1',
    filename: 'notes.txt',
    status: 'READY',
  })
  getChunks.mockResolvedValue(chunks)
})

describe('queryMaterial', () => {
  it('returns the grounded answer with its sources', async () => {
    generateStructured.mockResolvedValue({
      answer: 'It splits text into subword units.',
      foundInMaterial: true,
      quotedPassages: ['Tokenization splits text into subword units.'],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'What is tokenization?')
    expect(result.answer.foundInMaterial).toBe(true)
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].content).toContain('Tokenization')
  })

  it('sends only the retrieved passages to the model', async () => {
    generateStructured.mockResolvedValue({
      answer: 'a',
      foundInMaterial: true,
      quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await queryMaterial('m1', 'What is tokenization?')
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('Tokenization splits text')
    expect(prompt).not.toContain('Embeddings encode')
  })

  it('returns a not-found answer without calling the model when nothing matches', async () => {
    const { queryMaterial } = await import('@/lib/ai/material')
    const result = await queryMaterial('m1', 'quantum entanglement photons')
    expect(result.answer.foundInMaterial).toBe(false)
    expect(result.sources).toEqual([])
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { queryMaterial } = await import('@/lib/ai/material')
    await expect(queryMaterial('nope', 'q')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws MATERIAL_NOT_READY when the material is still processing', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1',
      filename: 'notes.txt',
      status: 'PROCESSING',
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await expect(queryMaterial('m1', 'q')).rejects.toMatchObject({
      code: 'MATERIAL_NOT_READY',
    })
  })

  it('uses a low temperature to stay close to the source', async () => {
    generateStructured.mockResolvedValue({
      answer: 'a',
      foundInMaterial: true,
      quotedPassages: [],
    })
    const { queryMaterial } = await import('@/lib/ai/material')
    await queryMaterial('m1', 'tokenization')
    expect(generateStructured.mock.calls[0][0].temperature).toBeLessThanOrEqual(0.2)
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test tests/ai/material.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `lib/ai/material.ts`**

```ts
import { ApiError } from '@/lib/api'
import { generateStructured } from '@/lib/ai/gemini'
import { groundedPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'
import { groundedAnswerSchema, type GroundedAnswer } from '@/lib/schemas/material'
import { findMaterial, getChunks } from '@/lib/repositories/material'
import { rankChunks, type RankedChunk } from '@/lib/text/retrieve'

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
  const sources = rankChunks(question, chunks, TOP_K)

  if (sources.length === 0) {
    return {
      answer: {
        answer:
          'Nothing in this document appears to address that question. Try rephrasing it using wording from the material.',
        foundInMaterial: false,
        quotedPassages: [],
      },
      sources: [],
    }
  }

  const answer = await generateStructured({
    prompt: groundedPrompt({
      filename: material.filename,
      question,
      passages: sources.map((s) => s.content),
    }),
    schema: groundedAnswerSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.2,
  })

  return { answer, sources }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/ai/material.test.ts`
Expected: PASS — `6 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/material.ts lib/ai/prompts.ts tests/ai/material.test.ts
git commit -m "feat(materials): add grounded question answering over retrieved chunks"
```

---

## Task 7: Material endpoints

**Files:**
- Create: `app/api/materials/route.ts`
- Create: `app/api/materials/[id]/route.ts`
- Create: `app/api/materials/[id]/query/route.ts`
- Test: `tests/api/materials.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/materials.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureDemoUser = vi.fn()
const createMaterial = vi.fn()
const storeChunks = vi.fn()
const markFailed = vi.fn()
const listMaterials = vi.fn()
const findMaterial = vi.fn()
const deleteMaterial = vi.fn()
const extractText = vi.fn()
const queryMaterial = vi.fn()

vi.mock('@/lib/repositories/assessment', () => ({ ensureDemoUser }))
vi.mock('@/lib/repositories/material', () => ({
  createMaterial,
  storeChunks,
  markFailed,
  listMaterials,
  findMaterial,
  deleteMaterial,
}))
vi.mock('@/lib/text/extract', async () => {
  const actual = await vi.importActual<typeof import('@/lib/text/extract')>(
    '@/lib/text/extract',
  )
  return { ...actual, extractText }
})
vi.mock('@/lib/ai/material', () => ({ queryMaterial }))

function upload(file: File) {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://t/api/materials', { method: 'POST', body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureDemoUser.mockResolvedValue({ id: 'u1' })
  createMaterial.mockResolvedValue({ id: 'm1', filename: 'notes.txt' })
})

describe('POST /api/materials', () => {
  it('accepts a text file and stores its chunks', async () => {
    extractText.mockResolvedValue('some extracted text')
    findMaterial.mockResolvedValue({ id: 'm1', status: 'READY', chunkCount: 1 })
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['hello'], 'notes.txt', { type: 'text/plain' })),
    )
    expect(res.status).toBe(201)
    expect(storeChunks).toHaveBeenCalled()
  })

  it('rejects an unsupported mime type with 400', async () => {
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['x'], 'image.png', { type: 'image/png' })),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('UNSUPPORTED_TYPE')
  })

  it('rejects a request with no file', async () => {
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      new Request('http://t/api/materials', {
        method: 'POST',
        body: new FormData(),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('marks the material FAILED when extraction throws', async () => {
    const { ApiError } = await import('@/lib/api')
    extractText.mockRejectedValue(
      new ApiError('EXTRACTION_FAILED', 'Scanned images only', 422),
    )
    const { POST } = await import('@/app/api/materials/route')
    const res = await POST(
      upload(new File(['x'], 'scan.pdf', { type: 'application/pdf' })),
    )
    expect(res.status).toBe(422)
    expect(markFailed).toHaveBeenCalledWith('m1', 'Scanned images only')
  })
})

describe('GET /api/materials', () => {
  it('returns the learner materials', async () => {
    listMaterials.mockResolvedValue([{ id: 'm1', filename: 'notes.txt' }])
    const { GET } = await import('@/app/api/materials/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

describe('DELETE /api/materials/[id]', () => {
  it('deletes an existing material', async () => {
    findMaterial.mockResolvedValue({ id: 'm1' })
    const { DELETE } = await import('@/app/api/materials/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    expect(deleteMaterial).toHaveBeenCalledWith('m1')
  })

  it('returns 404 for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/materials/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/materials/[id]/query', () => {
  it('returns the grounded answer', async () => {
    queryMaterial.mockResolvedValue({
      answer: { answer: 'yes', foundInMaterial: true, quotedPassages: [] },
      sources: [],
    })
    const { POST } = await import('@/app/api/materials/[id]/query/route')
    const res = await POST(
      new Request('http://t', {
        method: 'POST',
        body: JSON.stringify({ question: 'What is X?' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.answer.foundInMaterial).toBe(true)
  })

  it('rejects an empty question with 400', async () => {
    const { POST } = await import('@/app/api/materials/[id]/query/route')
    const res = await POST(
      new Request('http://t', {
        method: 'POST',
        body: JSON.stringify({ question: '' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/materials.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/materials/route.ts`**

Extraction and chunking happen inline. At this corpus size that is a few hundred milliseconds — a background job queue would be premature.

```ts
import { ApiError, handle, ok } from '@/lib/api'
import {
  createMaterial,
  findMaterial,
  listMaterials,
  markFailed,
  storeChunks,
} from '@/lib/repositories/material'
import { ensureDemoUser } from '@/lib/repositories/assessment'
import {
  extractText,
  isSupportedType,
  MAX_FILE_BYTES,
} from '@/lib/text/extract'
import { chunkText } from '@/lib/text/chunk'

export async function GET() {
  return handle(async () => {
    const user = await ensureDemoUser()
    const materials = await listMaterials(user.id)
    return ok(materials)
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new ApiError('VALIDATION_ERROR', 'No file was provided', 400)
    }
    if (!isSupportedType(file.type)) {
      throw new ApiError(
        'UNSUPPORTED_TYPE',
        'Only PDF, plain text and markdown files are supported',
        400,
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ApiError('FILE_TOO_LARGE', 'Files must be under 10 MB', 400)
    }

    const user = await ensureDemoUser()
    const material = await createMaterial({
      userId: user.id,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractText(buffer, file.type)
      const chunks = chunkText(text)

      if (chunks.length === 0) {
        throw new ApiError(
          'EXTRACTION_FAILED',
          'No readable text was found in this file',
          422,
        )
      }

      await storeChunks(material.id, chunks)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Processing failed unexpectedly'
      await markFailed(material.id, message)
      throw error
    }

    const ready = await findMaterial(material.id)
    return ok(ready, 201)
  })
}
```

- [ ] **Step 4: Create `app/api/materials/[id]/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import { deleteMaterial, findMaterial } from '@/lib/repositories/material'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const material = await findMaterial(id)
    if (!material) {
      throw new ApiError('NOT_FOUND', `No material with id "${id}"`, 404)
    }
    return ok(material)
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const material = await findMaterial(id)
    if (!material) {
      throw new ApiError('NOT_FOUND', `No material with id "${id}"`, 404)
    }
    await deleteMaterial(id)
    return ok({ deleted: true })
  })
}
```

- [ ] **Step 5: Create `app/api/materials/[id]/query/route.ts`**

```ts
import { handle, ok, parseJson } from '@/lib/api'
import { materialQuerySchema } from '@/lib/schemas/material'
import { queryMaterial } from '@/lib/ai/material'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const { question } = await parseJson(request, materialQuerySchema)
    const result = await queryMaterial(id, question)
    return ok(result)
  })
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/api/materials.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 7: Commit**

```bash
git add app/api/materials tests/api/materials.test.ts
git commit -m "feat(api): add material upload, list, delete and query endpoints"
```

---

## Task 8: Upload component

**Files:**
- Create: `components/material-upload.tsx`
- Test: `tests/components/material-upload.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/material-upload.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MaterialUpload } from '@/components/material-upload'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MaterialUpload', () => {
  it('renders the drop prompt', () => {
    render(<MaterialUpload onUploaded={() => {}} />)
    expect(screen.getByText(/Drop a PDF/i)).toBeInTheDocument()
  })

  it('lists the accepted formats', () => {
    render(<MaterialUpload onUploaded={() => {}} />)
    expect(screen.getByText(/PDF, TXT or MD/i)).toBeInTheDocument()
  })

  it('uploads the chosen file and calls onUploaded', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'm1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const onUploaded = vi.fn()
    const user = userEvent.setup()
    render(<MaterialUpload onUploaded={onUploaded} />)

    const input = screen.getByTestId('material-file-input')
    await user.upload(
      input,
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    )

    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce())
  })

  it('shows the server error when the upload fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'UNSUPPORTED_TYPE', message: 'Only PDF and text files' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    render(<MaterialUpload onUploaded={() => {}} />)

    await user.upload(
      screen.getByTestId('material-file-input'),
      new File(['x'], 'bad.png', { type: 'image/png' }),
    )

    expect(
      await screen.findByText('Only PDF and text files'),
    ).toBeInTheDocument()
  })

  it('rejects an oversized file before calling the server', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<MaterialUpload onUploaded={() => {}} />)

    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    await user.upload(screen.getByTestId('material-file-input'), big)

    expect(await screen.findByText(/under 10 MB/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/material-upload.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/material-upload.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetcher'
import type { MaterialSummary } from '@/lib/schemas/material'

const MAX_BYTES = 10 * 1024 * 1024

export function MaterialUpload({
  onUploaded,
}: {
  onUploaded: (material: MaterialSummary) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)

    if (file.size > MAX_BYTES) {
      setError('That file is too large. Files must be under 10 MB.')
      return
    }

    setPending(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const material = await apiFetch<MaterialSummary>('/api/materials', {
        method: 'POST',
        body: form,
      } as RequestInit)
      onUploaded(material)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void upload(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
          pending && 'pointer-events-none opacity-60',
        )}
      >
        {pending ? (
          <>
            <Spinner data-icon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Processing your document</p>
            <p className="text-xs text-muted-foreground">
              Extracting and indexing the text
            </p>
          </>
        ) : (
          <>
            <Upload data-icon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drop a PDF here, or click to choose
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, TXT or MD. Up to 10 MB.
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        data-testid="material-file-input"
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
```

Note: `apiFetch` sends `json` as a JSON body. For `FormData` the raw `body` is passed through and no `Content-Type` header is set, which is what the browser needs for multipart boundaries. If `apiFetch` rejects a non-`json` body, widen its `FetchOptions` type to allow `body?: BodyInit`.

- [ ] **Step 4: Widen `apiFetch` to accept FormData**

In `lib/fetcher.ts`, change the options type:

```ts
type FetchOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  body?: BodyInit
}
```

and destructure `body` alongside `json`, passing it through when `json` is absent:

```ts
  const { json, body, headers, ...rest } = options

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : body ? { body } : {}),
  })
```

- [ ] **Step 5: Run both affected test files**

Run: `npm test tests/components/material-upload.test.tsx tests/lib/fetcher.test.ts`
Expected: PASS — `5 passed` and `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/material-upload.tsx lib/fetcher.ts tests/components/material-upload.test.tsx
git commit -m "feat(materials): add drag and drop upload component"
```

---

## Task 9: Material list and Q&A

**Files:**
- Create: `components/material-list.tsx`
- Create: `components/material-qa.tsx`
- Test: `tests/components/material-list.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/material-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MaterialList } from '@/components/material-list'
import type { MaterialSummary } from '@/lib/schemas/material'

const ready: MaterialSummary = {
  id: 'm1',
  filename: 'lecture-notes.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 524288,
  status: 'READY',
  chunkCount: 12,
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('MaterialList', () => {
  it('renders an empty state when there are no materials', () => {
    render(<MaterialList materials={[]} />)
    expect(screen.getByText('No documents yet')).toBeInTheDocument()
  })

  it('renders the filename', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText('lecture-notes.pdf')).toBeInTheDocument()
  })

  it('renders a human readable size', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText(/512 KB/)).toBeInTheDocument()
  })

  it('renders the chunk count for a ready document', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText(/12 sections/)).toBeInTheDocument()
  })

  it('links a ready document to its detail page', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/materials/m1')
  })

  it('shows the error message for a failed document', () => {
    render(
      <MaterialList
        materials={[
          { ...ready, status: 'FAILED', error: 'Scanned images only', chunkCount: 0 },
        ]}
      />,
    )
    expect(screen.getByText('Scanned images only')).toBeInTheDocument()
  })

  it('does not link a failed document', () => {
    render(
      <MaterialList
        materials={[{ ...ready, status: 'FAILED', error: 'x', chunkCount: 0 }]}
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/material-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/material-list.tsx`**

```tsx
import Link from 'next/link'
import { AlertCircle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { MaterialSummary } from '@/lib/schemas/material'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_VARIANT: Record<
  MaterialSummary['status'],
  'secondary' | 'default' | 'destructive'
> = {
  UPLOADED: 'secondary',
  PROCESSING: 'secondary',
  READY: 'default',
  FAILED: 'destructive',
}

function Row({ material }: { material: MaterialSummary }) {
  const body = (
    <Card className="flex flex-row items-center gap-4 p-4 transition-colors hover:border-primary/50">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {material.status === 'FAILED' ? (
          <AlertCircle data-icon className="size-5 text-destructive" />
        ) : (
          <FileText data-icon className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{material.filename}</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(material.sizeBytes)}
          {material.status === 'READY' && ` · ${material.chunkCount} sections`}
        </span>
        {material.error && (
          <span className="text-xs text-destructive">{material.error}</span>
        )}
      </div>

      <Badge variant={STATUS_VARIANT[material.status]}>
        {material.status.toLowerCase()}
      </Badge>
    </Card>
  )

  if (material.status !== 'READY') return body

  return (
    <Link href={`/materials/${material.id}`} className="block">
      {body}
    </Link>
  )
}

export function MaterialList({
  materials,
}: {
  materials: MaterialSummary[]
}) {
  if (materials.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText data-icon />
          </EmptyMedia>
          <EmptyTitle>No documents yet</EmptyTitle>
          <EmptyDescription>
            Upload lecture notes or a paper, then ask questions about it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {materials.map((material) => (
        <Row key={material.id} material={material} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/material-qa.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Quote, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/fetcher'
import type { GroundedAnswer } from '@/lib/schemas/material'

type QueryResult = {
  answer: GroundedAnswer
  sources: { id: string; content: string; score: number }[]
}

export function MaterialQa({
  materialId,
  filename,
}: {
  materialId: string
  filename: string
}) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    const trimmed = question.trim()
    if (!trimmed || pending) return

    setPending(true)
    setError(null)
    try {
      const response = await apiFetch<QueryResult>(
        `/api/materials/${materialId}/query`,
        { method: 'POST', json: { question: trimmed } },
      )
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer that')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void ask()}
          placeholder={`Ask something about ${filename}...`}
          disabled={pending}
        />
        <Button
          onClick={() => void ask()}
          disabled={pending || question.trim().length === 0}
        >
          {pending ? <Spinner data-icon /> : <Search data-icon />}
          Ask
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {result.answer.foundInMaterial
                ? 'From your document'
                : 'Not covered in this document'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed">{result.answer.answer}</p>

            {result.answer.quotedPassages.length > 0 && (
              <>
                <Separator />
                <section className="flex flex-col gap-2">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Quote data-icon className="size-3.5" />
                    Supporting passages
                  </h3>
                  {result.answer.quotedPassages.map((passage, index) => (
                    <blockquote
                      key={index}
                      className="border-l-2 border-primary/40 bg-muted/50 py-2 pl-4 text-sm leading-relaxed text-muted-foreground"
                    >
                      {passage}
                    </blockquote>
                  ))}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/material-list.test.tsx`
Expected: PASS — `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/material-list.tsx components/material-qa.tsx tests/components/material-list.test.tsx
git commit -m "feat(ui): add material list and grounded q&a panel"
```

---

## Task 10: Materials pages

**Files:**
- Create: `app/materials/page.tsx`
- Create: `app/materials/materials-client.tsx`
- Create: `app/materials/[id]/page.tsx`

- [ ] **Step 1: Create `app/materials/materials-client.tsx`**

The list must update immediately after an upload, so it holds client state seeded from the server.

```tsx
'use client'

import { useState } from 'react'
import { MaterialUpload } from '@/components/material-upload'
import { MaterialList } from '@/components/material-list'
import type { MaterialSummary } from '@/lib/schemas/material'

export function MaterialsClient({
  initial,
}: {
  initial: MaterialSummary[]
}) {
  const [materials, setMaterials] = useState(initial)

  return (
    <div className="flex flex-col gap-6">
      <MaterialUpload
        onUploaded={(material) => setMaterials((prev) => [material, ...prev])}
      />
      <MaterialList materials={materials} />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/materials/page.tsx`**

```tsx
import { MaterialsClient } from './materials-client'
import { listMaterials } from '@/lib/repositories/material'
import { ensureDemoUser } from '@/lib/repositories/assessment'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your materials — Adaptive',
}

export default async function MaterialsPage() {
  const user = await ensureDemoUser()
  const materials = await listMaterials(user.id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your materials</h1>
        <p className="text-sm text-muted-foreground">
          Upload your own notes or papers. Answers come only from what you
          uploaded — never from the model&apos;s general knowledge.
        </p>
      </header>

      <MaterialsClient initial={materials} />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/materials/[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { MaterialQa } from '@/components/material-qa'
import { findMaterial } from '@/lib/repositories/material'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const material = await findMaterial(id)
  return {
    title: material ? `${material.filename} — Adaptive` : 'Material — Adaptive',
  }
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const material = await findMaterial(id)

  if (!material) notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/materials" />}>
              Materials
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{material.filename}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {material.filename}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{material.chunkCount} sections</Badge>
          <Badge variant="outline">{material.status.toLowerCase()}</Badge>
        </div>
      </header>

      <MaterialQa materialId={material.id} filename={material.filename} />
    </div>
  )
}
```

- [ ] **Step 4: Smoke-test with a real file**

Create a test document:

```bash
cat > /tmp/test-notes.txt <<'EOF'
Tokenization is the process of splitting raw text into tokens, which are
subword units drawn from a fixed vocabulary. Models operate on token ids
rather than characters because subwords balance vocabulary size against
coverage of rare words.

Embeddings are dense vector representations of tokens. Two embeddings that
are geometrically close encode semantically similar meanings. Embeddings are
what make semantic search possible.

The context window is the maximum number of tokens a model can attend to in
a single forward pass. It covers both the prompt and the generated output.
When input exceeds the window, the earliest tokens are dropped.
EOF
```

Run: `npm run dev`, open `/materials`, drop `/tmp/test-notes.txt` onto the upload area.
Expected: it processes in about a second and appears in the list with a `ready` badge and a section count.

- [ ] **Step 5: Test grounded answering**

Click the document. Ask: *"What is the context window?"*
Expected: an answer drawn from the third paragraph, with the supporting passage quoted below it, and the card titled **From your document**.

Now ask: *"What is the capital of France?"*
Expected: the card reads **Not covered in this document** and the answer declines rather than answering from general knowledge. This is the critical behaviour — if the model answers "Paris", the grounding has failed and the prompt needs tightening.

- [ ] **Step 6: Test the failure path**

Upload a PNG.
Expected: an inline error saying only PDF, text and markdown are supported. No row is added to the list.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/materials
git commit -m "feat(materials): add materials index and document q&a pages"
```

---

## Phase 5 Exit Checklist

- [ ] A TXT upload processes and reaches `READY` with a sensible section count
- [ ] A PDF upload processes and reaches `READY`
- [ ] An unsupported type is rejected with a clear message and no orphan row left in `READY`
- [ ] An oversized file is rejected client-side before any request
- [ ] Chunking never splits mid-word and always makes forward progress
- [ ] Retrieval returns an empty list rather than noise for an unrelated query
- [ ] A question the document does not cover returns `foundInMaterial: false` and the model does not answer from general knowledge
- [ ] Supporting passages are quoted verbatim from the source
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-06-student-maps.md`](./phase-06-student-maps.md).
