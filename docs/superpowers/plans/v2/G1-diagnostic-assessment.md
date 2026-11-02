# G1 — Diagnostic Assessment

**Depends on:** A1. **Blocks:** G5.

**Problem:** the adaptive engine has nothing to adapt to. A new learner has zero `Mastery` rows, so `recommend()` falls through to the LEARN branch for every ready concept and the Progress page reads the same sentence four times. The product's central claim — *"finds where your understanding actually stops"* — never happens.

The architecture document specifies a diagnostic on course start. It was never built.

**Decision:** a short diagnostic offered when a learner opens a course they have not started. 6–8 questions spanning the prerequisite graph's depth range, graded like any assessment, seeding `Mastery` so recommendations are meaningful from the first visit.

Skippable. A learner who wants to start at the beginning should not be forced through a quiz.

---

## Task 1: Concept sampling

Which concepts to test. Not random — sample across depth so the diagnostic finds the *boundary* of understanding, not just whether someone knows the basics.

**File:** create `lib/diagnostic.ts`, test `tests/lib/diagnostic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { sampleDiagnosticConcepts } from '@/lib/diagnostic'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name: string) {
  return {
    id, courseId: 'c1', name, definition: 'd',
    difficulty: 'BEGINNER' as const, objectives: [],
  }
}
function prereq(fromId: string, toId: string) {
  return { id: `${fromId}>${toId}`, fromId, toId, type: 'PREREQUISITE_OF' as const, strength: 1 }
}

// a -> b -> c -> d, plus two unrelated roots
const graph: ConceptGraph = {
  concepts: ['a','b','c','d','x','y'].map((id) => concept(id, id.toUpperCase())),
  relationships: [prereq('a','b'), prereq('b','c'), prereq('c','d')],
}

describe('sampleDiagnosticConcepts', () => {
  it('returns at most the requested count', () => {
    expect(sampleDiagnosticConcepts(graph, 4)).toHaveLength(4)
  })

  it('returns everything when the graph is smaller than the target', () => {
    const tiny: ConceptGraph = { concepts: [concept('a', 'A')], relationships: [] }
    expect(sampleDiagnosticConcepts(tiny, 8)).toHaveLength(1)
  })

  it('always includes a root concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 3).map((c) => c.id)
    expect(picked.some((id) => ['a', 'x', 'y'].includes(id))).toBe(true)
  })

  it('always includes the deepest concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 3).map((c) => c.id)
    expect(picked).toContain('d')
  })

  it('spreads across depth rather than clustering', () => {
    const picked = sampleDiagnosticConcepts(graph, 4)
    const depths = new Set(picked.map((c) => c.depth))
    expect(depths.size).toBeGreaterThanOrEqual(3)
  })

  it('reports the depth of each pick', () => {
    const picked = sampleDiagnosticConcepts(graph, 4)
    for (const c of picked) {
      expect(typeof c.depth).toBe('number')
    }
  })

  it('is deterministic', () => {
    const a = sampleDiagnosticConcepts(graph, 4).map((c) => c.id)
    const b = sampleDiagnosticConcepts(graph, 4).map((c) => c.id)
    expect(a).toEqual(b)
  })

  it('never repeats a concept', () => {
    const picked = sampleDiagnosticConcepts(graph, 6)
    expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length)
  })

  it('handles a graph with no relationships', () => {
    const flat: ConceptGraph = {
      concepts: ['p','q','r'].map((id) => concept(id, id)),
      relationships: [],
    }
    expect(sampleDiagnosticConcepts(flat, 2)).toHaveLength(2)
  })

  it('returns an empty array for an empty graph', () => {
    expect(sampleDiagnosticConcepts({ concepts: [], relationships: [] }, 5)).toEqual([])
  })
})
```

- [ ] **Step 2: Implement**

```ts
import { computeDepths } from '@/lib/concept-layout'
import type { ConceptDto, ConceptGraph } from '@/lib/schemas/concept'

export type DiagnosticConcept = ConceptDto & { depth: number }

export const DEFAULT_DIAGNOSTIC_SIZE = 7

/**
 * Picks concepts spanning the prerequisite graph's depth range.
 *
 * A diagnostic should locate the boundary of understanding, so it needs
 * coverage from roots to leaves rather than a random sample that might
 * land entirely in the shallows.
 */
export function sampleDiagnosticConcepts(
  graph: ConceptGraph,
  count: number = DEFAULT_DIAGNOSTIC_SIZE,
): DiagnosticConcept[] {
  if (graph.concepts.length === 0) return []
  if (graph.concepts.length <= count) {
    const depths = computeDepths(graph.concepts, graph.relationships)
    return graph.concepts.map((c) => ({ ...c, depth: depths.get(c.id) ?? 0 }))
  }

  const depths = computeDepths(graph.concepts, graph.relationships)

  const byDepth = new Map<number, ConceptDto[]>()
  for (const concept of graph.concepts) {
    const depth = depths.get(concept.id) ?? 0
    const bucket = byDepth.get(depth)
    if (bucket) bucket.push(concept)
    else byDepth.set(depth, [concept])
  }

  const levels = [...byDepth.keys()].sort((a, b) => a - b)
  const picked: DiagnosticConcept[] = []
  const taken = new Set<string>()

  const take = (depth: number) => {
    const bucket = byDepth.get(depth)
    if (!bucket) return
    // Name sort keeps the pick deterministic across runs.
    const next = [...bucket]
      .sort((a, b) => a.name.localeCompare(b.name))
      .find((c) => !taken.has(c.id))
    if (!next) return
    taken.add(next.id)
    picked.push({ ...next, depth })
  }

  // Anchor the extremes first — they define the range being probed.
  take(levels[0])
  if (levels.length > 1) take(levels[levels.length - 1])

  // Fill the middle, cycling depth levels so coverage stays even.
  let cursor = 0
  while (picked.length < count && taken.size < graph.concepts.length) {
    take(levels[cursor % levels.length])
    cursor += 1
    if (cursor > levels.length * graph.concepts.length) break
  }

  return picked.slice(0, count)
}
```

- [ ] **Step 3: Tests pass (10), commit**

```bash
git add lib/diagnostic.ts tests/lib/diagnostic.test.ts
git commit -m "feat(diagnostic): add depth-spanning concept sampler"
```

---

## Task 2: Generate and persist

Reuse the assessment machinery. A diagnostic is an `Assessment` with `kind: 'diagnostic'`.

**Files:** modify `lib/ai/prompts.ts`, `lib/ai/assessment.ts`, `lib/repositories/assessment.ts`

- [ ] **Step 1: A diagnostic-specific prompt**

```ts
export function diagnosticPrompt(request: {
  courseTitle: string
  concepts: { name: string; definition: string; depth: number }[]
}): string {
  const concepts = request.concepts
    .map((c) => `- ${c.name} (depth ${c.depth}): ${c.definition}`)
    .join('\n')

  return `Write a diagnostic quiz that locates where a learner's understanding stops.

Course: ${request.courseTitle}

Concepts to probe, ordered from foundational to advanced:
${concepts}

This is not a test of recall. Each question should reveal whether the learner
can reason with the concept.

Rules:
- Exactly one question per concept, in the order listed.
- Depth-0 concepts get MCQ. Deeper concepts get SHORT_ANSWER.
- Distractors must be plausible to someone with a partial understanding.
- Do not reference other concepts in the list — each question stands alone.

Return JSON:
{
  "questions": [
    {
      "type": "MCQ" | "SHORT_ANSWER",
      "prompt": "the question",
      "options": ["4 options for MCQ, [] for SHORT_ANSWER"],
      "correctAnswer": "exact option, or a model answer",
      "explanation": "why, in 1-2 sentences",
      "conceptName": "exact name from the list",
      "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
    }
  ]
}`
}
```

- [ ] **Step 2: Generation service**

In `lib/ai/assessment.ts`:

```ts
export async function generateDiagnostic(request: {
  courseTitle: string
  concepts: { name: string; definition: string; depth: number }[]
}): Promise<GeneratedQuiz> {
  return generateStructured({
    prompt: diagnosticPrompt(request),
    schema: generatedQuizSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.4,
    schemaName: 'diagnostic_quiz',
  })
}
```

`generatedQuizSchema` caps at 10 questions — a 7-question diagnostic fits.

- [ ] **Step 3: Track completion**

Add to `model User` in `prisma/schema.prisma`:

```prisma
  /// JSON string[] of course slugs whose diagnostic is done or skipped.
  diagnosedCourses String @default("[]")
```

```bash
npx prisma migrate dev --name add_diagnosed_courses
```

Then in `lib/repositories/user.ts`:

```ts
export async function hasTakenDiagnostic(
  userId: string,
  courseSlug: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { diagnosedCourses: true },
  })
  return readStringArray(user?.diagnosedCourses).includes(courseSlug)
}

export async function markDiagnosticTaken(
  userId: string,
  courseSlug: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { diagnosedCourses: true },
  })
  const current = readStringArray(user.diagnosedCourses)
  if (current.includes(courseSlug)) return

  await prisma.user.update({
    where: { id: userId },
    data: { diagnosedCourses: writeStringArray([...current, courseSlug]) },
  })
}
```

Both skipping and completing mark it — the banner must not reappear after a decline.

---

## Task 3: The endpoint

**File:** create `app/api/diagnostic/route.ts`

- [ ] **Step 1: Build it**

```ts
import { z } from 'zod'
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { slugSchema } from '@/lib/schemas/common'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'
import { createAssessment, type NewQuestion } from '@/lib/repositories/assessment'
import { markDiagnosticTaken } from '@/lib/repositories/user'
import { generateDiagnostic } from '@/lib/ai/assessment'
import { sampleDiagnosticConcepts, DEFAULT_DIAGNOSTIC_SIZE } from '@/lib/diagnostic'

const bodySchema = z.object({
  courseSlug: slugSchema,
  questionCount: z.number().int().min(3).max(10).default(DEFAULT_DIAGNOSTIC_SIZE),
})

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    const { courseSlug, questionCount } = await parseJson(request, bodySchema)

    const [course, graph] = await Promise.all([
      findCourseBySlug(courseSlug),
      getCourseGraph(courseSlug),
    ])
    if (!course || !graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${courseSlug}"`, 404)
    }

    const sampled = sampleDiagnosticConcepts(graph, questionCount)
    if (sampled.length === 0) {
      throw new ApiError('NOT_FOUND', 'This course has no concepts to test', 404)
    }

    const quiz = await generateDiagnostic({
      courseTitle: course.title,
      concepts: sampled.map((c) => ({
        name: c.name,
        definition: c.definition,
        depth: c.depth,
      })),
    })

    // Map generated questions back to real concept ids; drop anything
    // the model invented.
    const idByName = new Map(sampled.map((c) => [c.name, c.id]))
    const questions: NewQuestion[] = []
    for (const q of quiz.questions) {
      const conceptId = idByName.get(q.conceptName)
      if (!conceptId) {
        console.warn(`Diagnostic: dropping question for unknown "${q.conceptName}"`)
        continue
      }
      questions.push({
        conceptId,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })
    }

    if (questions.length === 0) {
      throw new ApiError(
        'AI_INVALID_RESPONSE',
        'The generated diagnostic did not match any concept in this course.',
        502,
      )
    }

    // The first topic is a reasonable anchor; a diagnostic spans the course.
    const anchorTopicId = sampled[0].topicId
    if (!anchorTopicId) {
      throw new ApiError('NOT_FOUND', 'Course concepts are not assigned to topics', 500)
    }

    const assessment = await createAssessment({
      userId: user.id,
      topicId: anchorTopicId,
      questions,
      kind: 'diagnostic',
    })

    await markDiagnosticTaken(user.id, courseSlug)

    return ok(assessment, 201)
  })
}

export async function PATCH(request: Request) {
  // Skip without taking it.
  return handle(async () => {
    const user = await requireUser()
    const { courseSlug } = await parseJson(
      request,
      z.object({ courseSlug: slugSchema }),
    )
    await markDiagnosticTaken(user.id, courseSlug)
    return ok({ skipped: true })
  })
}
```

`createAssessment` needs a `kind` parameter — currently hardcoded to `'practice'`.

- [ ] **Step 2: Tests**

Create `tests/api/diagnostic.test.ts` mocking `requireUser`, `getCourseGraph`, `findCourseBySlug`, `generateDiagnostic`, `createAssessment`, `markDiagnosticTaken`. Cover: success, unknown course 404, questions naming unknown concepts dropped, all-invalid → 502, unauthenticated → 401, PATCH marks skipped.

---

## Task 4: The prompt banner

**File:** create `components/diagnostic-prompt.tsx`

Shown on a course page when the learner has not been diagnosed.

- [ ] **Step 1: Build it**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/fetcher'

export function DiagnosticPrompt({
  courseSlug,
  conceptCount,
}: {
  courseSlug: string
  conceptCount: number
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function start() {
    setPending(true)
    try {
      const assessment = await apiFetch<{ id: string }>('/api/diagnostic', {
        method: 'POST',
        json: { courseSlug },
      })
      router.push(`/assessment/${assessment.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the diagnostic')
      setPending(false)
    }
  }

  async function skip() {
    setDismissed(true)
    try {
      await apiFetch('/api/diagnostic', {
        method: 'PATCH',
        json: { courseSlug },
      })
      router.refresh()
    } catch {
      // Dismissal is local anyway; a failed persist is not worth surfacing.
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Compass data-icon className="size-5 text-primary" />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-sm font-semibold">
            Find out what you already know
          </h3>
          <p className="text-sm text-muted-foreground">
            Seven questions across the {conceptCount} concepts in this course.
            The results decide where you start — no point teaching you things
            you can already do.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => void start()} disabled={pending}>
            {pending ? <Spinner data-icon /> : <Compass data-icon />}
            {pending ? 'Writing questions' : 'Take it'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void skip()}
            aria-label="Skip the diagnostic"
          >
            <X data-icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Render it on the course page**

In `app/courses/[slug]/page.tsx`, after the header:

```tsx
{user && !diagnosed && (
  <DiagnosticPrompt
    courseSlug={course.slug}
    conceptCount={course.conceptCount}
  />
)}
```

With `const diagnosed = user ? await hasTakenDiagnostic(user.id, slug) : true`.

---

## Task 5: Result framing

A diagnostic result should not read like a failed exam. Scoring 30% on unseen material is information, not failure.

**File:** modify `components/assessment-result.tsx`

- [ ] **Step 1: Accept a kind**

```tsx
export function AssessmentResult({
  score,
  results,
  kind = 'practice',
}: {
  score: number
  results: QuestionResult[]
  kind?: 'practice' | 'diagnostic'
})
```

- [ ] **Step 2: Diagnostic-specific copy**

```tsx
const DIAGNOSTIC_HEADLINE: Record<Recommendation, string> = {
  ADVANCE: 'You already know most of this',
  PRACTICE: 'A solid starting point',
  RETEACH: 'Starting from the beginning',
}

const DIAGNOSTIC_SUBLINE: Record<Recommendation, string> = {
  ADVANCE: 'Your path skips what you have already demonstrated.',
  PRACTICE: 'You have the foundations. The path starts where they run out.',
  RETEACH: 'Nothing here was familiar yet, so the path starts at the roots.',
}
```

Use these when `kind === 'diagnostic'`. Replace the score headline with *"Here is where you are"* and add a link to `/progress`.

---

## Task 6: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Cold-start walkthrough**

```bash
npx prisma db execute --stdin <<< "DELETE FROM Mastery;"
npx prisma db execute --stdin <<< "UPDATE User SET diagnosedCourses = '[]';"
```

- [ ] Open `/courses/generative-ai` → the diagnostic banner appears
- [ ] Click **Take it** → 7 questions spanning easy to hard
- [ ] Answer some correctly, some not
- [ ] Submit → results framed as a starting point, not a grade
- [ ] Open `/progress` → recommendations now differ per concept and reflect what you got wrong
- [ ] Return to the course → banner gone
- [ ] Dismiss on another course → banner gone there too, and stays gone after reload

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(diagnostic): add cold-start assessment on course open

The adaptive engine had no data for a new learner, so every recommendation
fell through to the same LEARN branch. A depth-spanning diagnostic seeds
Mastery on first visit, making the first Progress page meaningful.
Skippable, and skipping persists."
```

---

## Exit checklist

- [ ] Banner appears only for an undiagnosed course
- [ ] Questions span the prerequisite depth range
- [ ] Results read as a starting point, not a grade
- [ ] Mastery rows exist afterwards
- [ ] Recommendations differ per concept and reflect the result
- [ ] Skipping persists across reloads
- [ ] All four verification commands pass

Next: [`G2-session-tracking.md`](./G2-session-tracking.md).
