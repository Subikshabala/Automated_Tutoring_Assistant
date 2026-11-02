# Phase 3 — AI Tutor

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner opens a topic, reads a Gemini-generated explanation of each concept structured into simple explanation / why it matters / example / key points / check question, and can ask follow-up questions in a chat that knows which concept they are on.

**Architecture:** One thin Gemini client wraps the SDK and enforces Zod validation on every response — no caller ever sees unvalidated model output. Two services sit on top: `explainConcept` and `answerQuestion`. Two Route Handlers expose them. Explanations are cached in a `ConceptExplanation` table so the same concept is not regenerated on every page view. The chat is a client component; the explanation is server-rendered.

**Tech Stack:** `@google/genai` · Zod · Prisma · Next.js Route Handlers · shadcn/ui

**Depends on:** Phase 2 complete. `GEMINI_API_KEY` must be a working key.

**Done when:** `/learn/<slug>/<topicId>` renders real Gemini explanations for every concept in the topic, and the chat panel answers follow-up questions grounded in the current concept.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/ai/gemini.ts` | SDK wrapper, JSON mode, Zod validation, error mapping |
| `lib/ai/prompts.ts` | All prompt templates in one place |
| `lib/schemas/ai.ts` | Zod contracts for every AI response shape |
| `lib/ai/tutor.ts` | `explainConcept`, `answerQuestion` |
| `lib/repositories/explanation.ts` | Explanation cache read/write |
| `app/api/ai/explain/route.ts` | `POST` generate or fetch cached explanation |
| `app/api/ai/ask/route.ts` | `POST` answer a follow-up question |
| `components/concept-explanation.tsx` | Renders one structured explanation |
| `components/tutor-chat.tsx` | Chat panel (client) |
| `app/learn/[slug]/[topicId]/page.tsx` | Learn page |
| `app/learn/[slug]/[topicId]/loading.tsx` | Loading skeleton |

---

## Task 1: Add the explanation cache table

Gemini calls cost money and take seconds. Caching by concept makes the learn page fast on the second visit and keeps the demo cheap.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the model to `prisma/schema.prisma`**

```prisma
model ConceptExplanation {
  id                String   @id @default(cuid())
  conceptId         String   @unique
  title             String
  simpleExplanation String
  whyItMatters      String
  example           String
  keyPoints         String   @default("[]")
  checkQuestion     String
  model             String
  createdAt         DateTime @default(now())

  concept Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add the back-relation on `Concept`**

In the existing `model Concept` block, add this line to the relation list (next to `mastery` and `questions`):

```prisma
  explanation ConceptExplanation?
```

- [ ] **Step 3: Migrate**

Run: `npx prisma migrate dev --name add_concept_explanation`
Expected: creates and applies the migration, regenerates the client.

- [ ] **Step 4: Verify the table exists**

Run: `npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM ConceptExplanation;"`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add concept explanation cache table"
```

---

## Task 2: AI response schemas

Every shape the model is allowed to return lives here. Nothing downstream accepts raw model output.

**Files:**
- Create: `lib/schemas/ai.ts`
- Test: `tests/lib/schemas-ai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-ai.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  conceptExplanationSchema,
  tutorAnswerSchema,
} from '@/lib/schemas/ai'

const validExplanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens before processing it.',
  whyItMatters: 'Token count drives both cost and context limits.',
  example: 'The word "tokenization" might split into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why do models not operate on whole words?',
}

describe('conceptExplanationSchema', () => {
  it('accepts a well formed explanation', () => {
    expect(conceptExplanationSchema.parse(validExplanation).title).toBe(
      'Tokenization',
    )
  })

  it('rejects an empty simpleExplanation', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      simpleExplanation: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects fewer than two key points', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      keyPoints: ['only one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than six key points', () => {
    const result = conceptExplanationSchema.safeParse({
      ...validExplanation,
      keyPoints: ['1', '2', '3', '4', '5', '6', '7'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing checkQuestion', () => {
    const { checkQuestion: _omitted, ...rest } = validExplanation
    expect(conceptExplanationSchema.safeParse(rest).success).toBe(false)
  })
})

describe('tutorAnswerSchema', () => {
  const validAnswer = {
    answer: 'Because subword units balance vocabulary size against coverage.',
    relatedConcepts: ['Embeddings'],
    followUpQuestion: 'What happens to a word the tokenizer has never seen?',
  }

  it('accepts a well formed answer', () => {
    expect(tutorAnswerSchema.parse(validAnswer).answer).toContain('subword')
  })

  it('defaults relatedConcepts to an empty array', () => {
    const { relatedConcepts: _omitted, ...rest } = validAnswer
    expect(tutorAnswerSchema.parse(rest).relatedConcepts).toEqual([])
  })

  it('allows a null followUpQuestion', () => {
    const parsed = tutorAnswerSchema.parse({
      ...validAnswer,
      followUpQuestion: null,
    })
    expect(parsed.followUpQuestion).toBeNull()
  })

  it('rejects an empty answer', () => {
    expect(
      tutorAnswerSchema.safeParse({ ...validAnswer, answer: '' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-ai.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/ai'`.

- [ ] **Step 3: Create `lib/schemas/ai.ts`**

```ts
import { z } from 'zod'

export const conceptExplanationSchema = z.object({
  title: z.string().min(1),
  simpleExplanation: z.string().min(1),
  whyItMatters: z.string().min(1),
  example: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2).max(6),
  checkQuestion: z.string().min(1),
})

export const tutorAnswerSchema = z.object({
  answer: z.string().min(1),
  relatedConcepts: z.array(z.string()).default([]),
  followUpQuestion: z.string().nullable().default(null),
})

export type ConceptExplanation = z.infer<typeof conceptExplanationSchema>
export type TutorAnswer = z.infer<typeof tutorAnswerSchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-ai.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/ai.ts tests/lib/schemas-ai.test.ts
git commit -m "feat(ai): add zod contracts for explanation and tutor answer"
```

---

## Task 3: Gemini client

The single choke point for all model calls. If this is right, no unvalidated model output can reach the rest of the app.

**Files:**
- Create: `lib/ai/gemini.ts`
- Test: `tests/ai/gemini.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/gemini.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent }
  },
}))

const schema = z.object({ answer: z.string().min(1) })

beforeEach(() => {
  vi.resetModules()
  generateContent.mockReset()
  process.env.GEMINI_API_KEY = 'test-key'
  process.env.GEMINI_MODEL = 'gemini-2.0-flash'
})

async function subject() {
  return import('@/lib/ai/gemini')
}

describe('generateStructured', () => {
  it('returns parsed data for a valid model response', async () => {
    generateContent.mockResolvedValue({ text: '{"answer":"yes"}' })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).resolves.toEqual({ answer: 'yes' })
  })

  it('strips a markdown code fence before parsing', async () => {
    generateContent.mockResolvedValue({
      text: '```json\n{"answer":"yes"}\n```',
    })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).resolves.toEqual({ answer: 'yes' })
  })

  it('throws AI_INVALID_RESPONSE when the model returns non-json', async () => {
    generateContent.mockResolvedValue({ text: 'sorry, I cannot' })
    const { generateStructured } = await subject()
    await expect(generateStructured({ prompt: 'p', schema })).rejects.toMatchObject(
      { code: 'AI_INVALID_RESPONSE' },
    )
  })

  it('throws AI_INVALID_RESPONSE when json fails schema validation', async () => {
    generateContent.mockResolvedValue({ text: '{"answer":""}' })
    const { generateStructured } = await subject()
    await expect(generateStructured({ prompt: 'p', schema })).rejects.toMatchObject(
      { code: 'AI_INVALID_RESPONSE' },
    )
  })

  it('throws AI_UNAVAILABLE when the sdk call rejects', async () => {
    generateContent.mockRejectedValue(new Error('network down'))
    const { generateStructured } = await subject()
    await expect(generateStructured({ prompt: 'p', schema })).rejects.toMatchObject(
      { code: 'AI_UNAVAILABLE' },
    )
  })

  it('throws AI_NOT_CONFIGURED when the api key is absent', async () => {
    delete process.env.GEMINI_API_KEY
    const { generateStructured } = await subject()
    await expect(generateStructured({ prompt: 'p', schema })).rejects.toMatchObject(
      { code: 'AI_NOT_CONFIGURED' },
    )
  })

  it('requests a json mime type from the model', async () => {
    generateContent.mockResolvedValue({ text: '{"answer":"yes"}' })
    const { generateStructured } = await subject()
    await generateStructured({ prompt: 'p', schema })
    const call = generateContent.mock.calls[0][0]
    expect(call.config.responseMimeType).toBe('application/json')
  })

  it('passes the system instruction through when provided', async () => {
    generateContent.mockResolvedValue({ text: '{"answer":"yes"}' })
    const { generateStructured } = await subject()
    await generateStructured({ prompt: 'p', schema, system: 'be terse' })
    const call = generateContent.mock.calls[0][0]
    expect(call.config.systemInstruction).toBe('be terse')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/ai/gemini.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/gemini'`.

- [ ] **Step 3: Create `lib/ai/gemini.ts`**

```ts
import { GoogleGenAI } from '@google/genai'
import type { ZodType } from 'zod'
import { ApiError } from '@/lib/api'

const DEFAULT_MODEL = 'gemini-2.0-flash'

function stripFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export type GenerateOptions<T> = {
  prompt: string
  schema: ZodType<T>
  system?: string
  temperature?: number
}

export async function generateStructured<T>({
  prompt,
  schema,
  system,
  temperature = 0.4,
}: GenerateOptions<T>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ApiError(
      'AI_NOT_CONFIGURED',
      'GEMINI_API_KEY is not set on the server',
      500,
    )
  }

  const client = new GoogleGenAI({ apiKey })

  let text: string
  try {
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature,
        ...(system ? { systemInstruction: system } : {}),
      },
    })
    text = response.text ?? ''
  } catch (error) {
    console.error('Gemini request failed:', error)
    throw new ApiError(
      'AI_UNAVAILABLE',
      'The AI service is temporarily unavailable. Try again.',
      503,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(text))
  } catch {
    console.error('Gemini returned non-JSON:', text.slice(0, 500))
    throw new ApiError(
      'AI_INVALID_RESPONSE',
      'The AI returned an unreadable response. Try again.',
      502,
    )
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error('Gemini response failed validation:', result.error.issues)
    throw new ApiError(
      'AI_INVALID_RESPONSE',
      'The AI response did not match the expected format. Try again.',
      502,
    )
  }

  return result.data
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/ai/gemini.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/gemini.ts tests/ai/gemini.test.ts
git commit -m "feat(ai): add gemini client with json mode and zod validation"
```

---

## Task 4: Prompt templates

Keeping prompts in one file makes them reviewable and testable as data rather than scattered string literals.

**Files:**
- Create: `lib/ai/prompts.ts`
- Test: `tests/ai/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { askPrompt, explainPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'

const context = {
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text into tokens.',
  courseTitle: 'Generative AI Foundations',
  topicTitle: 'Text Representation',
  objectives: ['Explain subwords'],
}

describe('TUTOR_SYSTEM', () => {
  it('instructs the model to return json only', () => {
    expect(TUTOR_SYSTEM.toLowerCase()).toContain('json')
  })

  it('forbids inventing facts', () => {
    expect(TUTOR_SYSTEM.toLowerCase()).toContain('do not invent')
  })
})

describe('explainPrompt', () => {
  it('includes the concept name and definition', () => {
    const prompt = explainPrompt(context)
    expect(prompt).toContain('Tokenization')
    expect(prompt).toContain('Splitting text into tokens.')
  })

  it('includes the course and topic for grounding', () => {
    const prompt = explainPrompt(context)
    expect(prompt).toContain('Generative AI Foundations')
    expect(prompt).toContain('Text Representation')
  })

  it('includes the learning objectives', () => {
    expect(explainPrompt(context)).toContain('Explain subwords')
  })

  it('names every required output field', () => {
    const prompt = explainPrompt(context)
    for (const field of [
      'simpleExplanation',
      'whyItMatters',
      'example',
      'keyPoints',
      'checkQuestion',
    ]) {
      expect(prompt).toContain(field)
    }
  })
})

describe('askPrompt', () => {
  it('includes the learner question', () => {
    const prompt = askPrompt({ ...context, question: 'Why subwords?', history: [] })
    expect(prompt).toContain('Why subwords?')
  })

  it('includes prior turns when history is present', () => {
    const prompt = askPrompt({
      ...context,
      question: 'And then?',
      history: [
        { role: 'user', content: 'What is a token?' },
        { role: 'assistant', content: 'A subword unit.' },
      ],
    })
    expect(prompt).toContain('What is a token?')
    expect(prompt).toContain('A subword unit.')
  })

  it('omits the history section when there are no prior turns', () => {
    const prompt = askPrompt({ ...context, question: 'Why?', history: [] })
    expect(prompt).not.toContain('Conversation so far')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/ai/prompts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/ai/prompts.ts`**

```ts
export const TUTOR_SYSTEM = `You are a precise technology tutor.

Rules:
- Respond with raw JSON only. No markdown, no code fences, no prose outside the JSON.
- Do not invent facts, statistics, citations, or product behaviour. If you are unsure, say so inside the relevant field.
- Write plainly. Short sentences. No filler, no hype, no motivational padding.
- Assume the learner is intelligent but new to this specific concept.`

export type TutorContext = {
  conceptName: string
  conceptDefinition: string
  courseTitle: string
  topicTitle: string | null
  objectives: string[]
}

export function explainPrompt(context: TutorContext): string {
  const objectives =
    context.objectives.length > 0
      ? context.objectives.map((o) => `- ${o}`).join('\n')
      : '- (none specified)'

  return `Explain one concept to a learner.

Course: ${context.courseTitle}
Topic: ${context.topicTitle ?? 'General'}
Concept: ${context.conceptName}
Canonical definition: ${context.conceptDefinition}

Learning objectives the explanation must support:
${objectives}

Return JSON with exactly these fields:
{
  "title": "the concept name",
  "simpleExplanation": "2-4 sentences a newcomer understands, no jargon left undefined",
  "whyItMatters": "1-2 sentences on the practical consequence of understanding this",
  "example": "one concrete, specific example — real values, not placeholders",
  "keyPoints": ["2 to 6 short takeaways, each under 15 words"],
  "checkQuestion": "one open question that reveals whether they actually understood"
}`
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export function askPrompt(
  context: TutorContext & { question: string; history: ChatTurn[] },
): string {
  const history =
    context.history.length > 0
      ? `\nConversation so far:\n${context.history
          .map(
            (turn) =>
              `${turn.role === 'user' ? 'Learner' : 'Tutor'}: ${turn.content}`,
          )
          .join('\n')}\n`
      : ''

  return `Answer a learner's question about a specific concept.

Course: ${context.courseTitle}
Topic: ${context.topicTitle ?? 'General'}
Concept: ${context.conceptName}
Canonical definition: ${context.conceptDefinition}
${history}
Learner question: ${context.question}

Return JSON with exactly these fields:
{
  "answer": "a direct answer in 2-5 sentences, grounded in the concept above",
  "relatedConcepts": ["names of concepts worth reading next, or an empty array"],
  "followUpQuestion": "one question that deepens their understanding, or null"
}`
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/ai/prompts.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts.ts tests/ai/prompts.test.ts
git commit -m "feat(ai): add tutor prompt templates"
```

---

## Task 5: Explanation cache repository

**Files:**
- Create: `lib/repositories/explanation.ts`
- Test: `tests/repositories/explanation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/explanation.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  findCachedExplanation,
  saveExplanation,
} from '@/lib/repositories/explanation'

async function firstConceptId() {
  const concept = await prisma.concept.findFirstOrThrow({
    where: { name: 'Tokenization' },
  })
  return concept.id
}

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens.',
  whyItMatters: 'Token count drives cost.',
  example: '"tokenization" splits into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why not whole words?',
}

afterEach(async () => {
  await prisma.conceptExplanation.deleteMany({
    where: { conceptId: await firstConceptId() },
  })
})

describe('findCachedExplanation', () => {
  it('returns null when nothing is cached', async () => {
    await expect(
      findCachedExplanation(await firstConceptId()),
    ).resolves.toBeNull()
  })
})

describe('saveExplanation', () => {
  it('persists an explanation that can be read back', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.title).toBe('Tokenization')
  })

  it('round-trips keyPoints as a real array', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.keyPoints).toEqual([
      'Tokens are subwords',
      'Cost scales with tokens',
    ])
  })

  it('overwrites an existing cache entry rather than erroring', async () => {
    const conceptId = await firstConceptId()
    await saveExplanation(conceptId, explanation, 'gemini-2.0-flash')
    await saveExplanation(
      conceptId,
      { ...explanation, title: 'Updated' },
      'gemini-2.0-flash',
    )
    const cached = await findCachedExplanation(conceptId)
    expect(cached!.title).toBe('Updated')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/explanation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/explanation.ts`**

```ts
import prisma from '@/lib/prisma'
import { readStringArray, writeStringArray } from '@/lib/json-array'
import type { ConceptExplanation } from '@/lib/schemas/ai'

export async function findCachedExplanation(
  conceptId: string,
): Promise<ConceptExplanation | null> {
  const row = await prisma.conceptExplanation.findUnique({
    where: { conceptId },
  })
  if (!row) return null

  return {
    title: row.title,
    simpleExplanation: row.simpleExplanation,
    whyItMatters: row.whyItMatters,
    example: row.example,
    keyPoints: readStringArray(row.keyPoints),
    checkQuestion: row.checkQuestion,
  }
}

export async function saveExplanation(
  conceptId: string,
  explanation: ConceptExplanation,
  model: string,
): Promise<void> {
  const data = {
    title: explanation.title,
    simpleExplanation: explanation.simpleExplanation,
    whyItMatters: explanation.whyItMatters,
    example: explanation.example,
    keyPoints: writeStringArray(explanation.keyPoints),
    checkQuestion: explanation.checkQuestion,
    model,
  }

  await prisma.conceptExplanation.upsert({
    where: { conceptId },
    create: { conceptId, ...data },
    update: data,
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/explanation.test.ts`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/explanation.ts tests/repositories/explanation.test.ts
git commit -m "feat(ai): add explanation cache repository"
```

---

## Task 6: Tutor service

**Files:**
- Create: `lib/ai/tutor.ts`
- Test: `tests/ai/tutor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/tutor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
const findCachedExplanation = vi.fn()
const saveExplanation = vi.fn()
const findConceptById = vi.fn()

vi.mock('@/lib/ai/gemini', () => ({ generateStructured }))
vi.mock('@/lib/repositories/explanation', () => ({
  findCachedExplanation,
  saveExplanation,
}))
vi.mock('@/lib/repositories/concept', () => ({ findConceptById }))

const concept = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens.',
  difficulty: 'BEGINNER' as const,
  objectives: ['Explain subwords'],
  courseTitle: 'Generative AI Foundations',
  courseSlug: 'generative-ai',
  topicTitle: 'Text Representation',
  moduleTitle: 'How Language Models Work',
}

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text.',
  whyItMatters: 'Cost.',
  example: 'An example.',
  keyPoints: ['a', 'b'],
  checkQuestion: 'Why?',
}

beforeEach(() => {
  vi.clearAllMocks()
  findConceptById.mockResolvedValue(concept)
})

describe('explainConcept', () => {
  it('returns the cached explanation without calling the model', async () => {
    findCachedExplanation.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    const result = await explainConcept('x1')
    expect(result.explanation.title).toBe('Tokenization')
    expect(result.cached).toBe(true)
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('calls the model when nothing is cached', async () => {
    findCachedExplanation.mockResolvedValue(null)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    const result = await explainConcept('x1')
    expect(generateStructured).toHaveBeenCalledOnce()
    expect(result.cached).toBe(false)
  })

  it('persists a freshly generated explanation', async () => {
    findCachedExplanation.mockResolvedValue(null)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await explainConcept('x1')
    expect(saveExplanation).toHaveBeenCalledWith(
      'x1',
      explanation,
      expect.any(String),
    )
  })

  it('throws NOT_FOUND for an unknown concept', async () => {
    findConceptById.mockResolvedValue(null)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await expect(explainConcept('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('regenerates when forceRefresh is set, even with a cache hit', async () => {
    findCachedExplanation.mockResolvedValue(explanation)
    generateStructured.mockResolvedValue(explanation)
    const { explainConcept } = await import('@/lib/ai/tutor')
    await explainConcept('x1', { forceRefresh: true })
    expect(generateStructured).toHaveBeenCalledOnce()
  })
})

describe('answerQuestion', () => {
  const answer = {
    answer: 'Because subwords generalise.',
    relatedConcepts: ['Embeddings'],
    followUpQuestion: 'What about unseen words?',
  }

  it('returns the validated model answer', async () => {
    generateStructured.mockResolvedValue(answer)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    const result = await answerQuestion('x1', 'Why subwords?', [])
    expect(result.answer).toContain('subwords')
  })

  it('passes prior turns into the prompt', async () => {
    generateStructured.mockResolvedValue(answer)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    await answerQuestion('x1', 'And then?', [
      { role: 'user', content: 'What is a token?' },
    ])
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('What is a token?')
  })

  it('throws NOT_FOUND for an unknown concept', async () => {
    findConceptById.mockResolvedValue(null)
    const { answerQuestion } = await import('@/lib/ai/tutor')
    await expect(answerQuestion('nope', 'q', [])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/ai/tutor.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/tutor'`.

- [ ] **Step 3: Create `lib/ai/tutor.ts`**

```ts
import { ApiError } from '@/lib/api'
import { generateStructured } from '@/lib/ai/gemini'
import { askPrompt, explainPrompt, TUTOR_SYSTEM, type ChatTurn, type TutorContext } from '@/lib/ai/prompts'
import {
  conceptExplanationSchema,
  tutorAnswerSchema,
  type ConceptExplanation,
  type TutorAnswer,
} from '@/lib/schemas/ai'
import { findConceptById } from '@/lib/repositories/concept'
import {
  findCachedExplanation,
  saveExplanation,
} from '@/lib/repositories/explanation'

const DEFAULT_MODEL = 'gemini-2.0-flash'

async function loadContext(conceptId: string): Promise<TutorContext> {
  const concept = await findConceptById(conceptId)
  if (!concept) {
    throw new ApiError('NOT_FOUND', `No concept with id "${conceptId}"`, 404)
  }
  return {
    conceptName: concept.name,
    conceptDefinition: concept.definition,
    courseTitle: concept.courseTitle,
    topicTitle: concept.topicTitle,
    objectives: concept.objectives,
  }
}

export async function explainConcept(
  conceptId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{ explanation: ConceptExplanation; cached: boolean }> {
  const context = await loadContext(conceptId)

  if (!options.forceRefresh) {
    const cached = await findCachedExplanation(conceptId)
    if (cached) return { explanation: cached, cached: true }
  }

  const explanation = await generateStructured({
    prompt: explainPrompt(context),
    schema: conceptExplanationSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.3,
  })

  await saveExplanation(
    conceptId,
    explanation,
    process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
  )

  return { explanation, cached: false }
}

export async function answerQuestion(
  conceptId: string,
  question: string,
  history: ChatTurn[],
): Promise<TutorAnswer> {
  const context = await loadContext(conceptId)

  return generateStructured({
    prompt: askPrompt({ ...context, question, history }),
    schema: tutorAnswerSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.5,
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/ai/tutor.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tutor.ts tests/ai/tutor.test.ts
git commit -m "feat(ai): add tutor service with explanation caching"
```

---

## Task 7: Explain and ask endpoints

**Files:**
- Create: `app/api/ai/explain/route.ts`
- Create: `app/api/ai/ask/route.ts`
- Test: `tests/api/ai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/ai.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const explainConcept = vi.fn()
const answerQuestion = vi.fn()

vi.mock('@/lib/ai/tutor', () => ({ explainConcept, answerQuestion }))

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/ai/explain', () => {
  it('returns the explanation for a valid request', async () => {
    explainConcept.mockResolvedValue({
      explanation: { title: 'Tokenization' },
      cached: false,
    })
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', { conceptId: 'x1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.explanation.title).toBe('Tokenization')
    expect(body.data.cached).toBe(false)
  })

  it('rejects a missing conceptId with 400', async () => {
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', {}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('surfaces an AI_UNAVAILABLE error as 503', async () => {
    const { ApiError } = await import('@/lib/api')
    explainConcept.mockRejectedValue(
      new ApiError('AI_UNAVAILABLE', 'down', 503),
    )
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://t/api/ai/explain', { conceptId: 'x1' }))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/ai/ask', () => {
  it('returns the tutor answer for a valid request', async () => {
    answerQuestion.mockResolvedValue({
      answer: 'Because subwords generalise.',
      relatedConcepts: [],
      followUpQuestion: null,
    })
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', { conceptId: 'x1', question: 'Why?' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.answer).toContain('subwords')
  })

  it('rejects an empty question with 400', async () => {
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', { conceptId: 'x1', question: '' }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects a question over 1000 characters', async () => {
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', {
        conceptId: 'x1',
        question: 'a'.repeat(1001),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts an optional history array', async () => {
    answerQuestion.mockResolvedValue({
      answer: 'ok',
      relatedConcepts: [],
      followUpQuestion: null,
    })
    const { POST } = await import('@/app/api/ai/ask/route')
    const res = await POST(
      post('http://t/api/ai/ask', {
        conceptId: 'x1',
        question: 'Why?',
        history: [{ role: 'user', content: 'earlier' }],
      }),
    )
    expect(res.status).toBe(200)
    expect(answerQuestion).toHaveBeenCalledWith('x1', 'Why?', [
      { role: 'user', content: 'earlier' },
    ])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/ai.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/ai/explain/route.ts`**

```ts
import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { explainConcept } from '@/lib/ai/tutor'

const bodySchema = z.object({
  conceptId: z.string().min(1),
  forceRefresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { conceptId, forceRefresh } = await parseJson(request, bodySchema)
    const result = await explainConcept(conceptId, { forceRefresh })
    return ok(result)
  })
}
```

- [ ] **Step 4: Create `app/api/ai/ask/route.ts`**

```ts
import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { answerQuestion } from '@/lib/ai/tutor'

const bodySchema = z.object({
  conceptId: z.string().min(1),
  question: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .max(20)
    .default([]),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { conceptId, question, history } = await parseJson(request, bodySchema)
    const answer = await answerQuestion(conceptId, question, history)
    return ok(answer)
  })
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/api/ai.test.ts`
Expected: PASS — `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai tests/api/ai.test.ts
git commit -m "feat(api): add explain and ask endpoints"
```

---

## Task 8: Explanation component

**Files:**
- Create: `components/concept-explanation.tsx`
- Test: `tests/components/concept-explanation.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/concept-explanation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConceptExplanationCard } from '@/components/concept-explanation'

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens.',
  whyItMatters: 'Token count drives cost and context limits.',
  example: 'The word "tokenization" splits into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why do models not operate on whole words?',
}

describe('ConceptExplanationCard', () => {
  it('renders the title', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders the simple explanation', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(
      screen.getByText('Models split text into tokens.'),
    ).toBeInTheDocument()
  })

  it('renders the why-it-matters section', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Why it matters')).toBeInTheDocument()
    expect(
      screen.getByText('Token count drives cost and context limits.'),
    ).toBeInTheDocument()
  })

  it('renders the example', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Example')).toBeInTheDocument()
  })

  it('renders every key point', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Tokens are subwords')).toBeInTheDocument()
    expect(screen.getByText('Cost scales with tokens')).toBeInTheDocument()
  })

  it('renders the check question', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(
      screen.getByText('Why do models not operate on whole words?'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/concept-explanation.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/concept-explanation.tsx`**

```tsx
import { HelpCircle, Lightbulb, Target } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ConceptExplanation } from '@/lib/schemas/ai'

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon data-icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  )
}

export function ConceptExplanationCard({
  explanation,
}: {
  explanation: ConceptExplanation
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{explanation.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="text-[15px] leading-relaxed">
          {explanation.simpleExplanation}
        </p>

        <Separator />

        <Section icon={Target} title="Why it matters">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {explanation.whyItMatters}
          </p>
        </Section>

        <Section icon={Lightbulb} title="Example">
          <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">
            {explanation.example}
          </p>
        </Section>

        <Section icon={Target} title="Key points">
          <ul className="flex flex-col gap-1.5">
            {explanation.keyPoints.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-snug">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                {point}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={HelpCircle} title="Check yourself">
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm italic leading-relaxed">
            {explanation.checkQuestion}
          </p>
        </Section>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/concept-explanation.test.tsx`
Expected: PASS — `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/concept-explanation.tsx tests/components/concept-explanation.test.tsx
git commit -m "feat(ui): add structured concept explanation card"
```

---

## Task 9: Tutor chat

**Files:**
- Create: `components/tutor-chat.tsx`
- Test: `tests/components/tutor-chat.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tutor-chat.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorChat } from '@/components/tutor-chat'

function mockOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TutorChat', () => {
  it('shows a prompt when the conversation is empty', () => {
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)
    expect(screen.getByText(/Ask anything about Tokenization/)).toBeInTheDocument()
  })

  it('renders the learner message after submit', async () => {
    mockOk({ answer: 'Because subwords generalise.', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('Why subwords?')).toBeInTheDocument()
  })

  it('renders the tutor answer', async () => {
    mockOk({ answer: 'Because subwords generalise.', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(
      await screen.findByText('Because subwords generalise.'),
    ).toBeInTheDocument()
  })

  it('clears the input after a successful send', async () => {
    mockOk({ answer: 'ok', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows an error when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'AI is down' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('AI is down')).toBeInTheDocument()
  })

  it('does not send an empty question', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/tutor-chat.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/tutor-chat.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetcher'
import type { TutorAnswer } from '@/lib/schemas/ai'

type Turn = {
  role: 'user' | 'assistant'
  content: string
  relatedConcepts?: string[]
  followUpQuestion?: string | null
}

export function TutorChat({
  conceptId,
  conceptName,
}: {
  conceptId: string
  conceptName: string
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const question = input.trim()
    if (!question || pending) return

    setError(null)
    setPending(true)
    setInput('')

    const history = turns.map((t) => ({ role: t.role, content: t.content }))
    setTurns((prev) => [...prev, { role: 'user', content: question }])

    try {
      const answer = await apiFetch<TutorAnswer>('/api/ai/ask', {
        method: 'POST',
        json: { conceptId, question, history },
      })
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: answer.answer,
          relatedConcepts: answer.relatedConcepts,
          followUpQuestion: answer.followUpQuestion,
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 pr-3">
          {turns.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Sparkles data-icon className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ask anything about {conceptName}.
              </p>
            </div>
          )}

          {turns.map((turn, index) => (
            <div
              key={index}
              className={cn(
                'flex flex-col gap-2',
                turn.role === 'user' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                {turn.content}
              </div>

              {turn.relatedConcepts && turn.relatedConcepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {turn.relatedConcepts.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {turn.followUpQuestion && (
                <button
                  type="button"
                  onClick={() => setInput(turn.followUpQuestion!)}
                  className="max-w-[85%] rounded-lg border border-dashed px-3 py-2 text-left text-xs italic text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {turn.followUpQuestion}
                </button>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner data-icon className="size-4" />
              Thinking
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={`Ask about ${conceptName}...`}
          rows={2}
          className="resize-none"
          disabled={pending}
        />
        <Button
          onClick={() => void send()}
          disabled={pending || input.trim().length === 0}
          size="icon"
          aria-label="Send question"
        >
          {pending ? <Spinner data-icon /> : <Send data-icon />}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/tutor-chat.test.tsx`
Expected: PASS — `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/tutor-chat.tsx tests/components/tutor-chat.test.tsx
git commit -m "feat(ui): add tutor chat panel with history and follow-ups"
```

---

## Task 10: Topic repository lookup

The learn page needs a topic with its concepts, which the course repository does not currently expose.

**Files:**
- Modify: `lib/repositories/concept.ts`
- Test: `tests/repositories/topic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/topic.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { findTopicWithConcepts } from '@/lib/repositories/concept'

async function textRepresentationTopicId() {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { title: 'Text Representation' },
  })
  return topic.id
}

describe('findTopicWithConcepts', () => {
  it('returns the topic with its concepts in order', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(topic!.title).toBe('Text Representation')
    expect(topic!.concepts.map((c) => c.name)).toEqual([
      'Tokenization',
      'Embeddings',
      'Context Window',
    ])
  })

  it('includes the course title and slug for breadcrumbs', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(topic!.courseTitle).toBe('Generative AI Foundations')
    expect(topic!.courseSlug).toBe('generative-ai')
  })

  it('parses concept objectives into arrays', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(Array.isArray(topic!.concepts[0].objectives)).toBe(true)
  })

  it('returns null for an unknown topic id', async () => {
    await expect(findTopicWithConcepts('nope')).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/topic.test.ts`
Expected: FAIL — `findTopicWithConcepts is not a function`.

- [ ] **Step 3: Append to `lib/repositories/concept.ts`**

```ts
export type TopicWithConcepts = {
  id: string
  title: string
  description: string
  courseTitle: string
  courseSlug: string
  moduleTitle: string
  concepts: ConceptDto[]
}

export async function findTopicWithConcepts(
  topicId: string,
): Promise<TopicWithConcepts | null> {
  const row = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      module: {
        select: {
          title: true,
          course: { select: { title: true, slug: true } },
        },
      },
      concepts: { orderBy: { order: 'asc' } },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    courseTitle: row.module.course.title,
    courseSlug: row.module.course.slug,
    moduleTitle: row.module.title,
    concepts: row.concepts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      moduleId: c.moduleId,
      topicId: c.topicId,
      name: c.name,
      definition: c.definition,
      difficulty: c.difficulty,
      objectives: readStringArray(c.objectives),
    })),
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/topic.test.ts`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/concept.ts tests/repositories/topic.test.ts
git commit -m "feat(concepts): add topic-with-concepts lookup"
```

---

## Task 11: Learn page

**Files:**
- Create: `app/learn/[slug]/[topicId]/page.tsx`
- Create: `app/learn/[slug]/[topicId]/loading.tsx`
- Create: `components/learn-view.tsx`
- Modify: `app/courses/[slug]/page.tsx`

- [ ] **Step 1: Create `app/learn/[slug]/[topicId]/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
      <Skeleton className="h-[32rem] w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/learn-view.tsx`**

The tab state must be client-side so the chat knows which concept is active.

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { TutorChat } from '@/components/tutor-chat'
import { ConceptExplanationCard } from '@/components/concept-explanation'
import type { ConceptDto } from '@/lib/schemas/concept'
import type { ConceptExplanation } from '@/lib/schemas/ai'

export type ConceptWithExplanation = {
  concept: ConceptDto
  explanation: ConceptExplanation | null
  error: string | null
}

export function LearnView({ items }: { items: ConceptWithExplanation[] }) {
  const [activeId, setActiveId] = useState(items[0]?.concept.id ?? '')
  const active = items.find((i) => i.concept.id === activeId) ?? items[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Tabs value={activeId} onValueChange={setActiveId}>
        <TabsList className="flex-wrap">
          {items.map((item) => (
            <TabsTrigger key={item.concept.id} value={item.concept.id}>
              {item.concept.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {items.map((item) => (
          <TabsContent key={item.concept.id} value={item.concept.id}>
            {item.explanation ? (
              <ConceptExplanationCard explanation={item.explanation} />
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">
                {item.error ??
                  'This explanation could not be generated. Reload to try again.'}
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card className="flex h-[36rem] flex-col p-4 lg:sticky lg:top-6">
        <h2 className="mb-3 text-sm font-semibold">Ask the tutor</h2>
        {active && (
          <TutorChat
            key={active.concept.id}
            conceptId={active.concept.id}
            conceptName={active.concept.name}
          />
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/learn/[slug]/[topicId]/page.tsx`**

Explanations are generated server-side, in parallel, with per-concept error isolation — one failure must not blank the page.

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
import { LearnView, type ConceptWithExplanation } from '@/components/learn-view'
import { findTopicWithConcepts } from '@/lib/repositories/concept'
import { explainConcept } from '@/lib/ai/tutor'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topicId: string }>
}) {
  const { topicId } = await params
  const topic = await findTopicWithConcepts(topicId)
  return { title: topic ? `${topic.title} — Adaptive` : 'Learn — Adaptive' }
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string; topicId: string }>
}) {
  const { slug, topicId } = await params
  const topic = await findTopicWithConcepts(topicId)

  if (!topic || topic.courseSlug !== slug) notFound()

  const items: ConceptWithExplanation[] = await Promise.all(
    topic.concepts.map(async (concept) => {
      try {
        const { explanation } = await explainConcept(concept.id)
        return { concept, explanation, error: null }
      } catch (error) {
        return {
          concept,
          explanation: null,
          error:
            error instanceof Error
              ? error.message
              : 'Could not generate an explanation.',
        }
      }
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/courses/${slug}`} />}>
              {topic.courseTitle}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{topic.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {topic.moduleTitle}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">{topic.description}</p>
      </header>

      <LearnView items={items} />
    </div>
  )
}
```

- [ ] **Step 4: Link topics from the course page**

In `app/courses/[slug]/page.tsx`, the topic rows are currently plain `<div>` elements. Wrap each one in a link. Replace the opening `<div` of the topic row and its closing `</div>` with:

```tsx
                <Link
                  key={topic.id}
                  href={`/learn/${course.slug}/${topic.id}`}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-accent"
                >
```

and close it with `</Link>` instead of `</div>`. Remove the now-duplicated `key={topic.id}` from the inner element.

- [ ] **Step 5: Smoke-test against the real API**

Run: `npm run dev`, open `/courses/generative-ai`, click **Text Representation**.
Expected: after a few seconds, three tabs (Tokenization, Embeddings, Context Window) each showing a real generated explanation with all five sections. Switching tabs is instant. The chat panel on the right accepts a question and returns a grounded answer.

If you see "GEMINI_API_KEY is not set", stop and fix `.env`.

- [ ] **Step 6: Verify caching works**

Reload the page.
Expected: it renders in well under a second — the explanations now come from `ConceptExplanation`.

Confirm with: `npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM ConceptExplanation;"`
Expected: `3`.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 8: Commit**

```bash
git add "app/learn" components/learn-view.tsx "app/courses/[slug]/page.tsx"
git commit -m "feat(tutor): add learn page with generated explanations and chat"
```

---

## Phase 3 Exit Checklist

- [ ] `GEMINI_API_KEY` is set and a real call succeeds
- [ ] `generateStructured` rejects non-JSON, schema-invalid, and SDK-failure cases with distinct error codes
- [ ] No unvalidated model output reaches the database or the UI
- [ ] `/learn/generative-ai/<topicId>` renders real explanations for every concept in the topic
- [ ] A failed explanation degrades to an inline message without blanking the page
- [ ] Second page load is served from cache (`ConceptExplanation` row count > 0)
- [ ] Chat returns grounded answers; follow-up chips populate the input
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-04-assessment-mastery.md`](./phase-04-assessment-mastery.md).
