# G3 — Misconceptions

**Depends on:** G2. **Blocks:** G5.

**Problem:** the `Misconception` table exists and nothing writes to it.

```prisma
model Misconception {
  id          String   @id @default(cuid())
  userId      String
  conceptId   String
  description String
  evidence    String
  resolved    Boolean  @default(false)
  detectedAt  DateTime @default(now())
}
```

The grading service already produces exactly this data — `shortAnswerEvaluationSchema` returns `misunderstoodConcepts` and `missingPoints` — and then throws it away after rendering feedback once.

The architecture document's **Socratic repair** feature depends on it and was never built.

**Decision:** persist what grading already detects, surface it on Progress, and let the learner work through a misconception with the tutor until it resolves.

This is the feature that distinguishes the product from a quiz app. "You got question 3 wrong" is a grade. "You consistently conflate tokens with words" is teaching.

---

## Task 1: Persist from grading

**File:** create `lib/repositories/misconception.ts`, test `tests/repositories/misconception.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  listOpenMisconceptions,
  recordMisconception,
  resolveMisconception,
} from '@/lib/repositories/misconception'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'misc-test@example.com' },
    create: { email: 'misc-test@example.com', passwordHash: 'x', name: 'T' },
    update: {},
  })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.misconception.deleteMany({ where: { userId: user.id } })
})

describe('recordMisconception', () => {
  it('stores a new misconception', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordMisconception({
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'Said "each word becomes one token"',
    })
    const open = await listOpenMisconceptions(user.id)
    expect(open).toHaveLength(1)
    expect(open[0].description).toContain('whole words')
  })

  it('does not duplicate the same misconception', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'first attempt',
    }
    await recordMisconception(input)
    await recordMisconception({ ...input, evidence: 'second attempt' })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(1)
  })

  it('appends new evidence to an existing record', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'first attempt',
    }
    await recordMisconception(input)
    await recordMisconception({ ...input, evidence: 'second attempt' })
    const [open] = await listOpenMisconceptions(user.id)
    expect(open.evidence).toContain('first attempt')
    expect(open.evidence).toContain('second attempt')
  })

  it('reopens a resolved misconception that recurs', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    const input = {
      userId: user.id,
      conceptId: id,
      description: 'Treats tokens as whole words',
      evidence: 'e1',
    }
    await recordMisconception(input)
    const [first] = await listOpenMisconceptions(user.id)
    await resolveMisconception(first.id)
    expect(await listOpenMisconceptions(user.id)).toHaveLength(0)

    await recordMisconception({ ...input, evidence: 'e2' })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(1)
  })

  it('keeps misconceptions on different concepts separate', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Tokenization'),
      description: 'Same wording',
      evidence: 'e',
    })
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Embeddings'),
      description: 'Same wording',
      evidence: 'e',
    })
    expect(await listOpenMisconceptions(user.id)).toHaveLength(2)
  })
})

describe('listOpenMisconceptions', () => {
  it('returns an empty array for a clean learner', async () => {
    const user = await testUser()
    await expect(listOpenMisconceptions(user.id)).resolves.toEqual([])
  })

  it('includes the concept name for display', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id,
      conceptId: await conceptId('Tokenization'),
      description: 'd',
      evidence: 'e',
    })
    const [open] = await listOpenMisconceptions(user.id)
    expect(open.conceptName).toBe('Tokenization')
  })

  it('orders most recent first', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Tokenization'),
      description: 'older', evidence: 'e',
    })
    await new Promise((r) => setTimeout(r, 20))
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Embeddings'),
      description: 'newer', evidence: 'e',
    })
    const open = await listOpenMisconceptions(user.id)
    expect(open[0].description).toBe('newer')
  })

  it('excludes resolved entries', async () => {
    const user = await testUser()
    await recordMisconception({
      userId: user.id, conceptId: await conceptId('Tokenization'),
      description: 'd', evidence: 'e',
    })
    const [open] = await listOpenMisconceptions(user.id)
    await resolveMisconception(open.id)
    expect(await listOpenMisconceptions(user.id)).toEqual([])
  })
})

describe('resolveMisconception', () => {
  it('ignores an unknown id', async () => {
    await expect(resolveMisconception('nope')).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Implement**

```ts
import prisma from '@/lib/prisma'

export type MisconceptionRecord = {
  id: string
  conceptId: string
  conceptName: string
  courseSlug: string
  description: string
  evidence: string
  detectedAt: Date
}

export type RecordInput = {
  userId: string
  conceptId: string
  description: string
  evidence: string
}

/** Collapse wording differences so the same error is not stored twice. */
function normalise(description: string): string {
  return description.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
}

export async function recordMisconception(input: RecordInput): Promise<void> {
  const existing = await prisma.misconception.findMany({
    where: { userId: input.userId, conceptId: input.conceptId },
  })

  const match = existing.find(
    (m) => normalise(m.description) === normalise(input.description),
  )

  if (match) {
    // Same error again. Append the evidence and reopen if it had been
    // marked resolved — recurrence means it was not.
    await prisma.misconception.update({
      where: { id: match.id },
      data: {
        evidence: `${match.evidence}\n---\n${input.evidence}`,
        resolved: false,
        detectedAt: new Date(),
      },
    })
    return
  }

  await prisma.misconception.create({
    data: {
      userId: input.userId,
      conceptId: input.conceptId,
      description: input.description,
      evidence: input.evidence,
    },
  })
}

export async function listOpenMisconceptions(
  userId: string,
): Promise<MisconceptionRecord[]> {
  const rows = await prisma.misconception.findMany({
    where: { userId, resolved: false },
    orderBy: { detectedAt: 'desc' },
    include: {
      concept: {
        select: { id: true, name: true, course: { select: { slug: true } } },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    conceptId: row.conceptId,
    conceptName: row.concept.name,
    courseSlug: row.concept.course.slug,
    description: row.description,
    evidence: row.evidence,
    detectedAt: row.detectedAt,
  }))
}

export async function resolveMisconception(id: string): Promise<void> {
  await prisma.misconception.updateMany({
    where: { id, resolved: false },
    data: { resolved: true },
  })
}

export async function countOpenMisconceptions(userId: string): Promise<number> {
  return prisma.misconception.count({ where: { userId, resolved: false } })
}
```

- [ ] **Step 3: Tests pass (10), commit**

```bash
git add lib/repositories/misconception.ts tests/repositories/misconception.test.ts
git commit -m "feat(misconceptions): add repository with deduplication and recurrence"
```

---

## Task 2: Capture during grading

**File:** modify `lib/assessment-service.ts`, test `tests/lib/assessment-service.test.ts`

The evaluation already returns `misunderstoodConcepts` and `missingPoints`.

- [ ] **Step 1: Add failing cases**

```ts
it('records a misconception from a misunderstood concept', async () => {
  findQuestionsForGrading.mockResolvedValue([shortQuestion])
  evaluateShortAnswer.mockResolvedValue({
    correctness: 0.3,
    understoodConcepts: [],
    misunderstoodConcepts: ['Treats tokens as whole words'],
    missingPoints: [],
    feedback: 'Not quite.',
  })
  const { gradeSubmission } = await import('@/lib/assessment-service')
  await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'wrong' }])
  expect(recordMisconception).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'u1',
      conceptId: 'c1',
      description: 'Treats tokens as whole words',
    }),
  )
})

it('includes the learner answer as evidence', async () => {
  findQuestionsForGrading.mockResolvedValue([shortQuestion])
  evaluateShortAnswer.mockResolvedValue({
    correctness: 0.3, understoodConcepts: [],
    misunderstoodConcepts: ['Confuses X with Y'],
    missingPoints: [], feedback: 'f',
  })
  const { gradeSubmission } = await import('@/lib/assessment-service')
  await gradeSubmission('a1', 'u1', [
    { questionId: 'q2', response: 'my specific wrong answer' },
  ])
  expect(recordMisconception.mock.calls[0][0].evidence).toContain(
    'my specific wrong answer',
  )
})

it('does not record anything for a correct answer', async () => {
  findQuestionsForGrading.mockResolvedValue([shortQuestion])
  evaluateShortAnswer.mockResolvedValue({
    correctness: 0.95, understoodConcepts: ['Tokenization'],
    misunderstoodConcepts: [], missingPoints: [], feedback: 'Good.',
  })
  const { gradeSubmission } = await import('@/lib/assessment-service')
  await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'right' }])
  expect(recordMisconception).not.toHaveBeenCalled()
})

it('records one entry per misunderstood concept', async () => {
  findQuestionsForGrading.mockResolvedValue([shortQuestion])
  evaluateShortAnswer.mockResolvedValue({
    correctness: 0.2, understoodConcepts: [],
    misunderstoodConcepts: ['First error', 'Second error'],
    missingPoints: [], feedback: 'f',
  })
  const { gradeSubmission } = await import('@/lib/assessment-service')
  await gradeSubmission('a1', 'u1', [{ questionId: 'q2', response: 'x' }])
  expect(recordMisconception).toHaveBeenCalledTimes(2)
})

it('does not record for MCQ questions', async () => {
  findQuestionsForGrading.mockResolvedValue([mcqQuestion])
  const { gradeSubmission } = await import('@/lib/assessment-service')
  await gradeSubmission('a1', 'u1', [{ questionId: 'q1', response: 'wrong' }])
  expect(recordMisconception).not.toHaveBeenCalled()
})

it('survives a failure to persist a misconception', async () => {
  findQuestionsForGrading.mockResolvedValue([shortQuestion])
  evaluateShortAnswer.mockResolvedValue({
    correctness: 0.3, understoodConcepts: [],
    misunderstoodConcepts: ['Some error'], missingPoints: [], feedback: 'f',
  })
  recordMisconception.mockRejectedValue(new Error('db down'))
  const { gradeSubmission } = await import('@/lib/assessment-service')
  const result = await gradeSubmission('a1', 'u1', [
    { questionId: 'q2', response: 'x' },
  ])
  expect(result.score).toBeDefined()
})
```

Mock `@/lib/repositories/misconception`.

- [ ] **Step 2: Capture in the short-answer branch**

```ts
    } else {
      const evaluation = await evaluateShortAnswer({ ... })
      score = evaluation.correctness
      feedback = evaluation.feedback

      // Capture what the evaluator identified. A failure here must not
      // lose the learner's graded submission.
      for (const description of evaluation.misunderstoodConcepts) {
        try {
          await recordMisconception({
            userId,
            conceptId: question.conceptId,
            description,
            evidence: `Q: ${question.prompt}\nA: ${response}`,
          })
        } catch (error) {
          console.error('Could not record misconception:', error)
        }
      }
    }
```

- [ ] **Step 3: Resolve on recovery**

A learner who later answers the same concept well has likely fixed it.

```ts
  for (const [conceptId, scores] of byConcept) {
    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    await recordAttempt(userId, conceptId, average)

    // Strong recovery closes open misconceptions on that concept.
    if (average >= 0.8) {
      try {
        await resolveMisconceptionsForConcept(userId, conceptId)
      } catch (error) {
        console.error('Could not resolve misconceptions:', error)
      }
    }
  }
```

Add `resolveMisconceptionsForConcept` to the repository.

---

## Task 3: Socratic repair

A misconception the learner cannot address is just a label. Give them a way through it.

**Files:** `lib/ai/prompts.ts`, `app/api/misconceptions/[id]/repair/route.ts`

- [ ] **Step 1: A Socratic prompt**

```ts
export function repairPrompt(request: {
  conceptName: string
  conceptDefinition: string
  misconception: string
  evidence: string
}): string {
  return `A learner holds a specific misunderstanding. Help them find it themselves.

Concept: ${request.conceptName}
Definition: ${request.conceptDefinition}
What they appear to believe: ${request.misconception}
Evidence from their answer:
${request.evidence}

Rules:
- Do not state the correction. Ask a question that makes the contradiction visible.
- Use a concrete case where their belief gives a wrong result.
- One question. Short.
- Do not be arch or coy. This is a genuine question, not a riddle.

Return JSON:
{
  "question": "the Socratic question",
  "hint": "a nudge if they are stuck, still not the answer",
  "resolution": "the correction, shown only after they respond"
}`
}
```

- [ ] **Step 2: Schema and endpoint**

```ts
export const repairSchema = z.object({
  question: z.string().min(1),
  hint: z.string().min(1),
  resolution: z.string().min(1),
})
```

`POST /api/misconceptions/[id]/repair` generates it; `PATCH` marks resolved when the learner works through it.

---

## Task 4: Surface on Progress

**File:** create `components/misconception-list.tsx`, modify `app/progress/page.tsx`

- [ ] **Step 1: The list**

A `Card` section titled **Worth revisiting**, each entry showing the concept name, the misconception in plain language, and two actions: **Work through it** (opens the Socratic flow in a dialog) and **I understand this now** (resolves directly).

Keep the tone neutral. This is diagnostic information, not a scolding.

- [ ] **Step 2: Place it**

Directly under the recommendations section — a misconception is more actionable than a generic "practise this".

```tsx
{misconceptions.length > 0 && (
  <>
    <Separator />
    <MisconceptionList misconceptions={misconceptions} />
  </>
)}
```

---

## Task 5: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Live check**

Take an assessment and answer a short-answer question in a way that is *wrong in a specific way* rather than blank — for example, on Tokenization, write "each word becomes one token".

```bash
npx prisma db execute --stdin <<< "SELECT description, resolved FROM Misconception;"
```

- [ ] A misconception row exists naming the specific error
- [ ] Evidence includes the question and the answer
- [ ] Progress shows it under **Worth revisiting**
- [ ] **Work through it** produces a genuine Socratic question, not the answer
- [ ] Answering the same concept well later resolves it
- [ ] Repeating the same error appends evidence rather than duplicating

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(misconceptions): persist, surface and repair detected misunderstandings

Grading already identified misunderstoodConcepts and discarded them after
one render. They are now stored with evidence, deduplicated by normalised
description, reopened on recurrence, and resolved when the learner later
scores well. Progress surfaces them with a Socratic repair flow."
```

---

## Exit checklist

- [ ] Misconceptions persist from short-answer grading
- [ ] MCQ answers do not generate them
- [ ] Duplicates append evidence instead of creating rows
- [ ] Recurrence reopens a resolved entry
- [ ] Strong later performance resolves automatically
- [ ] Socratic repair asks rather than tells
- [ ] A persistence failure never loses a graded submission
- [ ] All four verification commands pass

Next: [`G4-admin-real.md`](./G4-admin-real.md).
