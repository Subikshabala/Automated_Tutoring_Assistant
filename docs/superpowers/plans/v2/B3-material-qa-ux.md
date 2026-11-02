# B3 — Material Q&A UX

**Depends on:** B2 (hybrid retrieval). **Blocks:** nothing.

**Problem:** the page gives the learner nothing to work with.

- A blank input with no hint of what the document can answer
- Ask once, the previous answer vanishes — no history
- Retrieved passages are hidden; the learner cannot tell *where* an answer came from
- A weak-match answer looks identical to a confident one

**Decision:** three additions. Suggested questions generated from the document, a running Q&A history, and visible source passages with a confidence signal.

---

## Task 1: Suggested questions

**Files:** `lib/schemas/material.ts`, `lib/ai/prompts.ts`, `lib/ai/material.ts`, `app/api/materials/[id]/suggestions/route.ts`

Generated once per document and cached on the `Material` row — this is not worth a model call per page view.

- [ ] **Step 1: Schema**

In `lib/schemas/material.ts`:

```ts
export const suggestedQuestionsSchema = z.object({
  questions: z.array(z.string().min(1)).min(3).max(5),
})

export type SuggestedQuestions = z.infer<typeof suggestedQuestionsSchema>
```

- [ ] **Step 2: Cache column**

In `prisma/schema.prisma`, on `model Material`:

```prisma
  /// JSON string[] of generated starter questions. Empty until generated.
  suggestions String @default("")
```

```bash
npx prisma migrate dev --name add_material_suggestions
```

- [ ] **Step 3: Prompt**

In `lib/ai/prompts.ts`:

```ts
export function suggestionsPrompt(
  filename: string,
  excerpt: string,
): string {
  return `Read the opening of a learner's document and propose questions it can answer.

Document: ${filename}

Excerpt:
${excerpt}

Rules:
- Every question must be answerable from this document. Do not invent topics.
- Write them as a learner would ask, not as a quiz.
- Vary the scope: one broad, the rest specific.
- Under 12 words each.

Return JSON:
{ "questions": ["3 to 5 questions"] }`
}
```

- [ ] **Step 4: Service**

In `lib/ai/material.ts`:

```ts
const SUGGESTION_EXCERPT_CHUNKS = 3

export async function getSuggestedQuestions(
  materialId: string,
): Promise<string[]> {
  const material = await findMaterial(materialId)
  if (!material) {
    throw new ApiError('NOT_FOUND', `No material with id "${materialId}"`, 404)
  }

  const cached = readStringArray(material.suggestions)
  if (cached.length > 0) return cached

  const chunks = await getChunks(materialId)
  if (chunks.length === 0) return []

  try {
    const { questions } = await generateStructured({
      prompt: suggestionsPrompt(
        material.filename,
        chunks
          .slice(0, SUGGESTION_EXCERPT_CHUNKS)
          .map((c) => c.content)
          .join('\n\n'),
      ),
      schema: suggestedQuestionsSchema,
      system: TUTOR_SYSTEM,
      temperature: 0.6,
      schemaName: 'suggested_questions',
    })

    await saveSuggestions(materialId, questions)
    return questions
  } catch (error) {
    // Suggestions are a convenience. Never block the page on them.
    console.error('Suggestion generation failed:', error)
    return []
  }
}
```

Add `saveSuggestions` to `lib/repositories/material.ts`, and surface `suggestions` on `MaterialSummary`.

- [ ] **Step 5: Endpoint**

`app/api/materials/[id]/suggestions/route.ts`:

```ts
import { handle, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { getSuggestedQuestions } from '@/lib/ai/material'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireUser()
    const { id } = await params
    return ok({ questions: await getSuggestedQuestions(id) })
  })
}
```

- [ ] **Step 6: Tests**

Append to `tests/ai/material.test.ts`:

```ts
describe('getSuggestedQuestions', () => {
  it('returns cached suggestions without calling the model', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY',
      suggestions: '["Cached one?","Cached two?","Cached three?"]',
    })
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    const result = await getSuggestedQuestions('m1')
    expect(result).toHaveLength(3)
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('generates and persists when nothing is cached', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    generateStructured.mockResolvedValue({
      questions: ['What is tokenization?', 'Why subwords?', 'What is a vocab?'],
    })
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    expect(await getSuggestedQuestions('m1')).toHaveLength(3)
    expect(saveSuggestions).toHaveBeenCalled()
  })

  it('returns an empty array when generation fails', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    generateStructured.mockRejectedValue(new Error('model down'))
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('m1')).resolves.toEqual([])
  })

  it('returns an empty array for a document with no chunks', async () => {
    findMaterial.mockResolvedValue({
      id: 'm1', filename: 'n.txt', status: 'READY', suggestions: '',
    })
    getChunks.mockResolvedValue([])
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('m1')).resolves.toEqual([])
  })

  it('throws NOT_FOUND for an unknown material', async () => {
    findMaterial.mockResolvedValue(null)
    const { getSuggestedQuestions } = await import('@/lib/ai/material')
    await expect(getSuggestedQuestions('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(materials): add cached suggested questions per document"
```

---

## Task 2: Q&A history with sources

**File:** rewrite `components/material-qa.tsx`, test `tests/components/material-qa.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaterialQa } from '@/components/material-qa'

function mockAnswer(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const grounded = {
  answer: { answer: 'It splits text into subword units.', foundInMaterial: true, quotedPassages: ['Tokenization splits text.'] },
  sources: [{ id: 'c1', content: 'Tokenization splits text into subword units.', order: 0, score: 0.8, keywordScore: 0.9, semanticScore: 0.7, viaFallback: false }],
}

beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })

describe('MaterialQa initial state', () => {
  it('renders the question input', () => {
    render(<MaterialQa materialId="m1" filename="notes.txt" suggestions={[]} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders suggestion chips when provided', () => {
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={['What is tokenization?', 'Why subwords?']} />)
    expect(screen.getByRole('button', { name: 'What is tokenization?' })).toBeInTheDocument()
  })

  it('omits the suggestion row when there are none', () => {
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    expect(screen.queryByText('Try asking')).not.toBeInTheDocument()
  })

  it('asks immediately when a suggestion is clicked', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={['Why subwords?']} />)
    await u.click(screen.getByRole('button', { name: 'Why subwords?' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })
})

describe('MaterialQa answering', () => {
  it('renders the question and the answer', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'What is tokenization?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('What is tokenization?')).toBeInTheDocument()
    expect(await screen.findByText('It splits text into subword units.')).toBeInTheDocument()
  })

  it('keeps earlier exchanges in history', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'First question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await screen.findByText('First question?')
    await u.type(screen.getByRole('textbox'), 'Second question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await screen.findByText('Second question?')
    expect(screen.getByText('First question?')).toBeInTheDocument()
  })

  it('clears the input after asking', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    const input = screen.getByRole('textbox')
    await u.type(input, 'Question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows the supporting passage', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'q')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('Tokenization splits text.')).toBeInTheDocument()
  })

  it('marks an answer the document does not cover', async () => {
    mockAnswer({
      answer: { answer: 'Not covered here.', foundInMaterial: false, quotedPassages: [] },
      sources: [],
    })
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'capital of France?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('Not in this document')).toBeInTheDocument()
  })

  it('flags a weak retrieval match', async () => {
    mockAnswer({
      answer: { answer: 'Possibly related.', foundInMaterial: true, quotedPassages: [] },
      sources: [{ id: 'c1', content: 'x', order: 0, score: 0.05, keywordScore: 0, semanticScore: 0.05, viaFallback: true }],
    })
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'vague')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText(/No close match/)).toBeInTheDocument()
  })

  it('shows the server error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'AI is down' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }),
    )
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'q')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('AI is down')).toBeInTheDocument()
  })

  it('does not submit an empty question', async () => {
    const spy = vi.fn()
    global.fetch = spy
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rewrite the component**

Key structural changes from the current version:

```tsx
type Exchange = {
  question: string
  answer: GroundedAnswer
  sources: RankedChunk[]
}

export function MaterialQa({
  materialId,
  filename,
  suggestions,
}: {
  materialId: string
  filename: string
  suggestions: string[]
}) {
  const [history, setHistory] = useState<Exchange[]>([])
  // ...
}
```

Render order:

1. **Input row** — `Input` + `Ask` button, `Spinner` while pending
2. **Suggestion chips** — only when `history.length === 0 && suggestions.length > 0`, under a `Try asking` label, each a `Button variant="outline" size="sm"` that calls `ask(text)` directly
3. **History** — newest first. Each exchange is a `Card`:
   - Question as a muted label above the answer
   - A `Badge` header: `From your document` (secondary) or `Not in this document` (outline)
   - When every source is `viaFallback`, an `Alert` reading *"No close match — answered from the document's opening sections."*
   - Answer text
   - `Separator`, then quoted passages as `blockquote` elements with `border-l-2 border-primary/40`
   - A collapsible `Retrieved passages` section showing each source's content and score, so the learner can audit retrieval

Follow the existing conventions: `gap-*` not `space-y-*`, `data-icon` on icons, semantic tokens, `cn()` for conditionals.

- [ ] **Step 3: Tests pass (13), commit**

```bash
git add components/material-qa.tsx tests/components/material-qa.test.tsx
git commit -m "feat(materials): add q&a history, suggestions and source visibility"
```

---

## Task 3: Page wiring

**File:** modify `app/materials/[id]/page.tsx`

- [ ] **Step 1: Fetch suggestions server-side**

```tsx
const [material, questions] = await Promise.all([
  findMaterial(id),
  getSuggestedQuestions(id).catch(() => [] as string[]),
])

if (!material) notFound()
```

Pass `suggestions={questions}` to `MaterialQa`.

- [ ] **Step 2: Add a chunk-count hint to the header**

Under the existing badges:

```tsx
<p className="text-sm text-muted-foreground">
  Answers come only from this document. If it does not cover something,
  the tutor will say so rather than guess.
</p>
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 4: Live check**

Upload a document. Expected:

- 3–5 suggestion chips appear under the input
- Clicking one asks it immediately
- The answer shows with its supporting passage quoted
- Asking a second question keeps the first visible
- An off-topic question shows **Not in this document**
- A vague question shows the **No close match** notice but still answers

- [ ] **Step 5: Commit**

```bash
git add "app/materials/[id]/page.tsx"
git commit -m "feat(materials): wire suggestions into the document page"
```

---

## Exit checklist

- [ ] Suggested questions generate once and cache on the material row
- [ ] Suggestion generation failure degrades silently — the page still works
- [ ] Q&A history accumulates, newest first
- [ ] Supporting passages are quoted verbatim
- [ ] Retrieved passages are auditable with their scores
- [ ] Weak matches are visibly flagged
- [ ] Off-topic questions are declined
- [ ] All four verification commands pass

Part B complete. RAG works. Next: [`C1-layout-spacing.md`](./C1-layout-spacing.md).
