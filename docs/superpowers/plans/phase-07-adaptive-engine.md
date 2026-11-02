# Phase 7 — Adaptive Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The platform tells a learner what to do next — which concept to study, which to practise, which to revisit — derived from their actual mastery data and the prerequisite graph, with a reason attached to every recommendation.

**Architecture:** Recommendation is a pure function of three inputs: the course concept graph, the learner's mastery records, and a set of ranking rules. No model call is needed to decide *what* to recommend — only to phrase the encouraging summary, and that degrades gracefully. Prerequisite readiness is computed from the graph so a learner is never pointed at a concept whose foundations they have not met.

**Tech Stack:** Prisma · Zod · pure TypeScript · Gemini (optional narrative) · shadcn/ui

**Depends on:** Phase 4 complete (mastery records exist) and Phase 2 complete (prerequisite graph exists).

**Done when:** `/progress` shows per-course mastery and a ranked, reasoned list of next actions that visibly changes after taking an assessment.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/schemas/recommendation.ts` | Recommendation and progress contracts |
| `lib/adaptive.ts` | Pure readiness + ranking algorithm |
| `lib/repositories/progress.ts` | Course progress aggregation |
| `lib/ai/coach.ts` | Optional narrative summary |
| `app/api/progress/route.ts` | `GET` all-course progress |
| `app/api/recommendations/route.ts` | `GET` ranked next actions |
| `components/mastery-bar.tsx` | One concept's mastery row |
| `components/recommendation-card.tsx` | One recommended action |
| `components/course-progress-card.tsx` | Per-course summary |
| `app/progress/page.tsx` | Progress dashboard |
| `app/progress/loading.tsx` | Loading skeleton |

---

## Task 1: Recommendation schemas

**Files:**
- Create: `lib/schemas/recommendation.ts`
- Test: `tests/lib/schemas-recommendation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-recommendation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  coachSummarySchema,
  courseProgressSchema,
  recommendationSchema,
} from '@/lib/schemas/recommendation'

describe('recommendationSchema', () => {
  const recommendation = {
    conceptId: 'c1',
    conceptName: 'Attention',
    courseSlug: 'generative-ai',
    topicId: 't1',
    action: 'LEARN' as const,
    reason: 'You have not started this yet and its prerequisites are met.',
    priority: 82,
    masteryScore: 0,
  }

  it('accepts a well formed recommendation', () => {
    expect(recommendationSchema.parse(recommendation).action).toBe('LEARN')
  })

  it('accepts every valid action', () => {
    for (const action of ['LEARN', 'PRACTISE', 'REVIEW']) {
      expect(
        recommendationSchema.safeParse({ ...recommendation, action }).success,
      ).toBe(true)
    }
  })

  it('rejects an unknown action', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, action: 'SKIP' })
        .success,
    ).toBe(false)
  })

  it('rejects a priority above 100', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, priority: 101 })
        .success,
    ).toBe(false)
  })

  it('rejects an empty reason', () => {
    expect(
      recommendationSchema.safeParse({ ...recommendation, reason: '' }).success,
    ).toBe(false)
  })

  it('allows a null topicId', () => {
    expect(
      recommendationSchema.parse({ ...recommendation, topicId: null }).topicId,
    ).toBeNull()
  })
})

describe('courseProgressSchema', () => {
  const progress = {
    courseSlug: 'generative-ai',
    courseTitle: 'Generative AI Foundations',
    totalConcepts: 11,
    startedConcepts: 4,
    masteredConcepts: 2,
    averageMastery: 58,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well formed progress record', () => {
    expect(courseProgressSchema.parse(progress).totalConcepts).toBe(11)
  })

  it('allows a null lastActivityAt for an untouched course', () => {
    expect(
      courseProgressSchema.parse({ ...progress, lastActivityAt: null })
        .lastActivityAt,
    ).toBeNull()
  })

  it('rejects an average mastery above 100', () => {
    expect(
      courseProgressSchema.safeParse({ ...progress, averageMastery: 101 })
        .success,
    ).toBe(false)
  })
})

describe('coachSummarySchema', () => {
  it('accepts a well formed summary', () => {
    const parsed = coachSummarySchema.parse({
      headline: 'Strong week on the fundamentals.',
      body: 'You mastered tokenization and embeddings. Attention is next.',
    })
    expect(parsed.headline).toContain('Strong')
  })

  it('rejects an empty headline', () => {
    expect(
      coachSummarySchema.safeParse({ headline: '', body: 'x' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-recommendation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/recommendation'`.

- [ ] **Step 3: Create `lib/schemas/recommendation.ts`**

```ts
import { z } from 'zod'
import { idSchema, slugSchema } from './common'

export const actionSchema = z.enum(['LEARN', 'PRACTISE', 'REVIEW'])

export const recommendationSchema = z.object({
  conceptId: idSchema,
  conceptName: z.string().min(1),
  courseSlug: slugSchema,
  topicId: idSchema.nullable(),
  action: actionSchema,
  reason: z.string().min(1),
  priority: z.number().min(0).max(100),
  masteryScore: z.number().min(0).max(100),
})

export const courseProgressSchema = z.object({
  courseSlug: slugSchema,
  courseTitle: z.string().min(1),
  totalConcepts: z.number().int().min(0),
  startedConcepts: z.number().int().min(0),
  masteredConcepts: z.number().int().min(0),
  averageMastery: z.number().min(0).max(100),
  lastActivityAt: z.string().nullable(),
})

export const coachSummarySchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
})

export type LearningAction = z.infer<typeof actionSchema>
export type Recommendation = z.infer<typeof recommendationSchema>
export type CourseProgress = z.infer<typeof courseProgressSchema>
export type CoachSummary = z.infer<typeof coachSummarySchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-recommendation.test.ts`
Expected: PASS — `11 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/recommendation.ts tests/lib/schemas-recommendation.test.ts
git commit -m "feat(adaptive): add zod contracts for recommendations and progress"
```

---

## Task 2: Adaptive ranking algorithm

Pure, deterministic, and the single most important function in this phase. A learner should never be sent to a concept they are not ready for.

**Files:**
- Create: `lib/adaptive.ts`
- Test: `tests/lib/adaptive.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/adaptive.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isReady, recommend } from '@/lib/adaptive'
import type { ConceptGraph } from '@/lib/schemas/concept'
import type { MasteryWithConcept } from '@/lib/repositories/mastery'

function concept(id: string, name: string, topicId: string | null = 't1') {
  return {
    id,
    courseId: 'course1',
    topicId,
    name,
    definition: 'd',
    difficulty: 'BEGINNER' as const,
    objectives: [],
  }
}

function prereq(fromId: string, toId: string) {
  return {
    id: `${fromId}->${toId}`,
    fromId,
    toId,
    type: 'PREREQUISITE_OF' as const,
    strength: 1,
  }
}

function mastery(
  conceptId: string,
  conceptName: string,
  score: number,
  status: MasteryWithConcept['status'],
): MasteryWithConcept {
  return {
    conceptId,
    conceptName,
    masteryScore: score,
    confidenceScore: 0.5,
    attemptCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    status,
    lastAssessmentAt: new Date(),
  }
}

// a -> b -> c  (a is a prerequisite of b, b of c)
const graph: ConceptGraph = {
  concepts: [concept('a', 'Alpha'), concept('b', 'Beta'), concept('c', 'Gamma')],
  relationships: [prereq('a', 'b'), prereq('b', 'c')],
}

describe('isReady', () => {
  it('returns true for a concept with no prerequisites', () => {
    expect(isReady('a', graph, new Map())).toBe(true)
  })

  it('returns false when a prerequisite is unstarted', () => {
    expect(isReady('b', graph, new Map())).toBe(false)
  })

  it('returns false when a prerequisite is below the readiness threshold', () => {
    const scores = new Map([['a', 40]])
    expect(isReady('b', graph, scores)).toBe(false)
  })

  it('returns true when a prerequisite is at the readiness threshold', () => {
    const scores = new Map([['a', 65]])
    expect(isReady('b', graph, scores)).toBe(true)
  })

  it('requires every prerequisite, not just one', () => {
    const wide: ConceptGraph = {
      concepts: [concept('a', 'A'), concept('b', 'B'), concept('z', 'Z')],
      relationships: [prereq('a', 'z'), prereq('b', 'z')],
    }
    expect(isReady('z', wide, new Map([['a', 90]]))).toBe(false)
    expect(isReady('z', wide, new Map([['a', 90], ['b', 90]]))).toBe(true)
  })
})

describe('recommend', () => {
  it('recommends only the ready root concept for a brand new learner', () => {
    const results = recommend(graph, [], 'generative-ai')
    expect(results.map((r) => r.conceptName)).toEqual(['Alpha'])
  })

  it('labels an unstarted ready concept as LEARN', () => {
    const results = recommend(graph, [], 'generative-ai')
    expect(results[0].action).toBe('LEARN')
  })

  it('unlocks the next concept once its prerequisite is strong enough', () => {
    const records = [mastery('a', 'Alpha', 85, 'MASTERED')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results.map((r) => r.conceptName)).toContain('Beta')
  })

  it('does not recommend a mastered concept', () => {
    const records = [mastery('a', 'Alpha', 85, 'MASTERED')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results.map((r) => r.conceptName)).not.toContain('Alpha')
  })

  it('labels a weak concept as REVIEW', () => {
    const records = [mastery('a', 'Alpha', 30, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    const alpha = results.find((r) => r.conceptName === 'Alpha')
    expect(alpha!.action).toBe('REVIEW')
  })

  it('labels a mid-range concept as PRACTISE', () => {
    const records = [mastery('a', 'Alpha', 70, 'PRACTICING')]
    const results = recommend(graph, records, 'generative-ai')
    const alpha = results.find((r) => r.conceptName === 'Alpha')
    expect(alpha!.action).toBe('PRACTISE')
  })

  it('ranks a REVIEW above a LEARN', () => {
    const records = [mastery('a', 'Alpha', 25, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results[0].action).toBe('REVIEW')
  })

  it('gives every recommendation a non-empty reason', () => {
    const records = [mastery('a', 'Alpha', 30, 'NEEDS_REVIEW')]
    for (const result of recommend(graph, records, 'generative-ai')) {
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('names the blocking prerequisite in a REVIEW reason', () => {
    const records = [mastery('a', 'Alpha', 25, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results[0].reason.toLowerCase()).toContain('unlock')
  })

  it('sorts results by descending priority', () => {
    const records = [
      mastery('a', 'Alpha', 30, 'NEEDS_REVIEW'),
      mastery('b', 'Beta', 70, 'PRACTICING'),
    ]
    const results = recommend(graph, records, 'generative-ai')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].priority).toBeGreaterThanOrEqual(results[i].priority)
    }
  })

  it('respects the limit argument', () => {
    const wide: ConceptGraph = {
      concepts: Array.from({ length: 10 }, (_, i) =>
        concept(`n${i}`, `Node ${i}`),
      ),
      relationships: [],
    }
    expect(recommend(wide, [], 'generative-ai', 3)).toHaveLength(3)
  })

  it('returns an empty array when every concept is mastered', () => {
    const records = [
      mastery('a', 'Alpha', 90, 'MASTERED'),
      mastery('b', 'Beta', 90, 'MASTERED'),
      mastery('c', 'Gamma', 90, 'MASTERED'),
    ]
    expect(recommend(graph, records, 'generative-ai')).toEqual([])
  })

  it('carries the course slug through to every recommendation', () => {
    for (const result of recommend(graph, [], 'generative-ai')) {
      expect(result.courseSlug).toBe('generative-ai')
    }
  })

  it('handles a graph with no concepts', () => {
    expect(
      recommend({ concepts: [], relationships: [] }, [], 'generative-ai'),
    ).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/adaptive.test.ts`
Expected: FAIL — `Cannot find module '@/lib/adaptive'`.

- [ ] **Step 3: Create `lib/adaptive.ts`**

```ts
import type { ConceptGraph } from '@/lib/schemas/concept'
import type { MasteryWithConcept } from '@/lib/repositories/mastery'
import type {
  LearningAction,
  Recommendation,
} from '@/lib/schemas/recommendation'

/** A prerequisite must reach this score before its dependents unlock. */
export const READINESS_THRESHOLD = 65

/** At or above this, a concept is considered done and drops out of recommendations. */
export const MASTERED_THRESHOLD = 80

/** Below this, a concept needs reteaching rather than practice. */
export const REVIEW_THRESHOLD = 50

const DEFAULT_LIMIT = 6

export function isReady(
  conceptId: string,
  graph: ConceptGraph,
  scoreByConcept: Map<string, number>,
): boolean {
  const prerequisites = graph.relationships.filter(
    (r) => r.type === 'PREREQUISITE_OF' && r.toId === conceptId,
  )

  return prerequisites.every(
    (r) => (scoreByConcept.get(r.fromId) ?? 0) >= READINESS_THRESHOLD,
  )
}

function actionFor(score: number, started: boolean): LearningAction {
  if (!started) return 'LEARN'
  if (score < REVIEW_THRESHOLD) return 'REVIEW'
  return 'PRACTISE'
}

/**
 * Priority bands, highest first:
 *   REVIEW   90..100 — a weak foundation blocks everything downstream
 *   PRACTISE 60..80  — close to mastery, cheap to finish
 *   LEARN    30..55  — new ground, ready to start
 * Within a band, lower mastery and more unlocked dependents rank higher.
 */
function priorityFor(
  action: LearningAction,
  score: number,
  unlocksCount: number,
): number {
  const unlockBonus = Math.min(10, unlocksCount * 3)

  if (action === 'REVIEW') {
    return Math.min(100, 90 + Math.round((REVIEW_THRESHOLD - score) / 5))
  }
  if (action === 'PRACTISE') {
    return Math.min(
      80,
      60 + Math.round((MASTERED_THRESHOLD - score) / 2) + unlockBonus,
    )
  }
  return Math.min(55, 30 + unlockBonus)
}

function reasonFor(
  action: LearningAction,
  conceptName: string,
  score: number,
  unlocks: string[],
): string {
  if (action === 'REVIEW') {
    const downstream =
      unlocks.length > 0
        ? ` It needs to be solid before ${unlocks.slice(0, 2).join(' and ')} will unlock.`
        : ' Getting this right makes the rest easier.'
    return `Your score on ${conceptName} is ${score}, which suggests the idea has not landed yet.${downstream}`
  }

  if (action === 'PRACTISE') {
    return `You are at ${score} on ${conceptName}. One more round of questions should take it to mastery.`
  }

  const downstream =
    unlocks.length > 0
      ? ` It opens up ${unlocks.slice(0, 2).join(' and ')}.`
      : ''
  return `You have not started ${conceptName} and its prerequisites are covered.${downstream}`
}

export function recommend(
  graph: ConceptGraph,
  masteryRecords: MasteryWithConcept[],
  courseSlug: string,
  limit: number = DEFAULT_LIMIT,
): Recommendation[] {
  if (graph.concepts.length === 0) return []

  const scoreByConcept = new Map(
    masteryRecords.map((m) => [m.conceptId, m.masteryScore]),
  )
  const startedConcepts = new Set(
    masteryRecords.filter((m) => m.attemptCount > 0).map((m) => m.conceptId),
  )
  const nameById = new Map(graph.concepts.map((c) => [c.id, c.name]))

  const unlocksByConcept = new Map<string, string[]>()
  for (const rel of graph.relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    const targetName = nameById.get(rel.toId)
    if (!targetName) continue
    const bucket = unlocksByConcept.get(rel.fromId)
    if (bucket) {
      bucket.push(targetName)
    } else {
      unlocksByConcept.set(rel.fromId, [targetName])
    }
  }

  const recommendations: Recommendation[] = []

  for (const concept of graph.concepts) {
    const score = scoreByConcept.get(concept.id) ?? 0
    const started = startedConcepts.has(concept.id)

    if (score >= MASTERED_THRESHOLD) continue
    if (!started && !isReady(concept.id, graph, scoreByConcept)) continue

    const action = actionFor(score, started)
    const unlocks = unlocksByConcept.get(concept.id) ?? []

    recommendations.push({
      conceptId: concept.id,
      conceptName: concept.name,
      courseSlug,
      topicId: concept.topicId ?? null,
      action,
      reason: reasonFor(action, concept.name, score, unlocks),
      priority: priorityFor(action, score, unlocks.length),
      masteryScore: score,
    })
  }

  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/adaptive.test.ts`
Expected: PASS — `20 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/adaptive.ts tests/lib/adaptive.test.ts
git commit -m "feat(adaptive): add pure readiness and recommendation ranking"
```

---

## Task 3: Progress repository

**Files:**
- Create: `lib/repositories/progress.ts`
- Test: `tests/repositories/progress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/progress.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { ensureDemoUser } from '@/lib/repositories/assessment'
import { recordAttempt } from '@/lib/repositories/mastery'
import { getAllCourseProgress } from '@/lib/repositories/progress'

async function conceptId(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

afterEach(async () => {
  const user = await ensureDemoUser()
  await prisma.mastery.deleteMany({ where: { userId: user.id } })
})

describe('getAllCourseProgress', () => {
  it('returns one row per published course', async () => {
    const user = await ensureDemoUser()
    const progress = await getAllCourseProgress(user.id)
    expect(progress).toHaveLength(3)
  })

  it('reports the total concept count per course', async () => {
    const user = await ensureDemoUser()
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.totalConcepts).toBe(11)
  })

  it('reports zero started for an untouched course', async () => {
    const user = await ensureDemoUser()
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.startedConcepts).toBe(0)
    expect(genAi!.averageMastery).toBe(0)
    expect(genAi!.lastActivityAt).toBeNull()
  })

  it('counts a started concept after one attempt', async () => {
    const user = await ensureDemoUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 0.6)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.startedConcepts).toBe(1)
  })

  it('counts a mastered concept after two strong attempts', async () => {
    const user = await ensureDemoUser()
    const id = await conceptId('Tokenization')
    await recordAttempt(user.id, id, 1)
    await recordAttempt(user.id, id, 1)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.masteredConcepts).toBe(1)
  })

  it('averages mastery across started concepts only', async () => {
    const user = await ensureDemoUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    await recordAttempt(user.id, await conceptId('Embeddings'), 0)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.averageMastery).toBe(50)
  })

  it('sets lastActivityAt once there is activity', async () => {
    const user = await ensureDemoUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    const progress = await getAllCourseProgress(user.id)
    const genAi = progress.find((p) => p.courseSlug === 'generative-ai')
    expect(genAi!.lastActivityAt).not.toBeNull()
  })

  it('does not leak activity from one course into another', async () => {
    const user = await ensureDemoUser()
    await recordAttempt(user.id, await conceptId('Tokenization'), 1)
    const progress = await getAllCourseProgress(user.id)
    const agents = progress.find((p) => p.courseSlug === 'ai-agents')
    expect(agents!.startedConcepts).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/progress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/progress.ts`**

```ts
import prisma from '@/lib/prisma'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'
import type { CourseProgress } from '@/lib/schemas/recommendation'

export async function getAllCourseProgress(
  userId: string,
): Promise<CourseProgress[]> {
  const courses = await prisma.course.findMany({
    where: { published: true },
    orderBy: { title: 'asc' },
    select: {
      slug: true,
      title: true,
      _count: { select: { concepts: true } },
    },
  })

  const masteryRows = await prisma.mastery.findMany({
    where: { userId },
    include: {
      concept: { select: { course: { select: { slug: true } } } },
    },
  })

  const bySlug = new Map<
    string,
    { scores: number[]; mastered: number; lastActivity: Date | null }
  >()

  for (const row of masteryRows) {
    const slug = row.concept.course.slug
    const bucket = bySlug.get(slug) ?? {
      scores: [],
      mastered: 0,
      lastActivity: null,
    }

    bucket.scores.push(row.masteryScore)
    if (row.masteryScore >= MASTERED_THRESHOLD) bucket.mastered += 1
    if (
      !bucket.lastActivity ||
      row.lastInteractionAt > bucket.lastActivity
    ) {
      bucket.lastActivity = row.lastInteractionAt
    }

    bySlug.set(slug, bucket)
  }

  return courses.map((course) => {
    const bucket = bySlug.get(course.slug)
    const scores = bucket?.scores ?? []
    const average =
      scores.length === 0
        ? 0
        : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    return {
      courseSlug: course.slug,
      courseTitle: course.title,
      totalConcepts: course._count.concepts,
      startedConcepts: scores.length,
      masteredConcepts: bucket?.mastered ?? 0,
      averageMastery: average,
      lastActivityAt: bucket?.lastActivity?.toISOString() ?? null,
    }
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/progress.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/progress.ts tests/repositories/progress.test.ts
git commit -m "feat(adaptive): add per-course progress aggregation"
```

---

## Task 4: Coach summary

Narrative only. The recommendations themselves are already decided.

**Files:**
- Modify: `lib/ai/prompts.ts`
- Create: `lib/ai/coach.ts`
- Test: `tests/ai/coach.test.ts`

- [ ] **Step 1: Append the prompt to `lib/ai/prompts.ts`**

```ts
export type CoachRequest = {
  masteredCount: number
  startedCount: number
  totalCount: number
  topRecommendations: { conceptName: string; action: string }[]
}

export function coachPrompt(request: CoachRequest): string {
  const actions =
    request.topRecommendations.length > 0
      ? request.topRecommendations
          .map((r) => `${r.action.toLowerCase()} ${r.conceptName}`)
          .join(', ')
      : '(nothing outstanding)'

  return `Write a short status note for a learner. The plan is already decided — you are only phrasing it.

Concepts mastered: ${request.masteredCount}
Concepts started: ${request.startedCount}
Concepts in total: ${request.totalCount}
Next actions already chosen: ${actions}

Rules:
- No praise for its own sake. State what is true.
- No exclamation marks. No "great job". No "keep it up".
- Reference the actual numbers and concept names.
- Two sentences maximum in the body.

Return JSON:
{
  "headline": "under 8 words, factual",
  "body": "1-2 sentences"
}`
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/ai/coach.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/gemini', () => ({ generateStructured }))

const input = {
  masteredCount: 2,
  startedCount: 5,
  totalCount: 28,
  topRecommendations: [
    { conceptName: 'Attention', action: 'LEARN' },
    { conceptName: 'Embeddings', action: 'PRACTISE' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateCoachSummary', () => {
  it('returns the validated summary', async () => {
    generateStructured.mockResolvedValue({
      headline: 'Two concepts mastered',
      body: 'Attention is next.',
    })
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary(input)
    expect(result.headline).toBe('Two concepts mastered')
  })

  it('includes the concept names in the prompt', async () => {
    generateStructured.mockResolvedValue({ headline: 'h', body: 'b' })
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    await generateCoachSummary(input)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('Attention')
  })

  it('falls back to deterministic text when the model fails', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary(input)
    expect(result.headline).toContain('2')
    expect(result.body).toContain('Attention')
  })

  it('handles an empty recommendation list in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary({
      ...input,
      topRecommendations: [],
    })
    expect(result.body.length).toBeGreaterThan(0)
  })

  it('handles a brand new learner in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('down'))
    const { generateCoachSummary } = await import('@/lib/ai/coach')
    const result = await generateCoachSummary({
      masteredCount: 0,
      startedCount: 0,
      totalCount: 28,
      topRecommendations: [{ conceptName: 'Tokenization', action: 'LEARN' }],
    })
    expect(result.body).toContain('Tokenization')
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test tests/ai/coach.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `lib/ai/coach.ts`**

```ts
import { generateStructured } from '@/lib/ai/gemini'
import { coachPrompt, TUTOR_SYSTEM, type CoachRequest } from '@/lib/ai/prompts'
import {
  coachSummarySchema,
  type CoachSummary,
} from '@/lib/schemas/recommendation'

function fallback(request: CoachRequest): CoachSummary {
  const next = request.topRecommendations[0]

  const headline =
    request.startedCount === 0
      ? 'Ready to start'
      : `${request.masteredCount} of ${request.totalCount} concepts mastered`

  const body = next
    ? `You have started ${request.startedCount} concepts. Next: ${next.action.toLowerCase()} ${next.conceptName}.`
    : `You have started ${request.startedCount} of ${request.totalCount} concepts. Nothing is outstanding right now.`

  return { headline, body }
}

export async function generateCoachSummary(
  request: CoachRequest,
): Promise<CoachSummary> {
  try {
    return await generateStructured({
      prompt: coachPrompt(request),
      schema: coachSummarySchema,
      system: TUTOR_SYSTEM,
      temperature: 0.5,
    })
  } catch (error) {
    console.error('Coach summary generation failed, using fallback:', error)
    return fallback(request)
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/ai/coach.test.ts`
Expected: PASS — `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/coach.ts lib/ai/prompts.ts tests/ai/coach.test.ts
git commit -m "feat(adaptive): add coach summary with deterministic fallback"
```

---

## Task 5: Progress and recommendation endpoints

**Files:**
- Create: `app/api/progress/route.ts`
- Create: `app/api/recommendations/route.ts`
- Test: `tests/api/progress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/progress.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureDemoUser = vi.fn()
const getAllCourseProgress = vi.fn()
const listMasteryForCourse = vi.fn()
const getCourseGraph = vi.fn()

vi.mock('@/lib/repositories/assessment', () => ({ ensureDemoUser }))
vi.mock('@/lib/repositories/progress', () => ({ getAllCourseProgress }))
vi.mock('@/lib/repositories/mastery', () => ({ listMasteryForCourse }))
vi.mock('@/lib/repositories/concept', () => ({ getCourseGraph }))

const graph = {
  concepts: [
    {
      id: 'c1',
      courseId: 'course1',
      topicId: 't1',
      name: 'Tokenization',
      definition: 'd',
      difficulty: 'BEGINNER',
      objectives: [],
    },
  ],
  relationships: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureDemoUser.mockResolvedValue({ id: 'u1' })
})

describe('GET /api/progress', () => {
  it('returns per-course progress', async () => {
    getAllCourseProgress.mockResolvedValue([
      { courseSlug: 'generative-ai', totalConcepts: 11 },
    ])
    const { GET } = await import('@/app/api/progress/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

describe('GET /api/recommendations', () => {
  it('returns recommendations for a course', async () => {
    getCourseGraph.mockResolvedValue(graph)
    listMasteryForCourse.mockResolvedValue([])
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request('http://t/api/recommendations?courseSlug=generative-ai'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].conceptName).toBe('Tokenization')
  })

  it('rejects a request with no courseSlug', async () => {
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(new Request('http://t/api/recommendations'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown course', async () => {
    getCourseGraph.mockResolvedValue(null)
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request('http://t/api/recommendations?courseSlug=nope'),
    )
    expect(res.status).toBe(404)
  })

  it('respects the limit query param', async () => {
    getCourseGraph.mockResolvedValue({
      concepts: Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        courseId: 'course1',
        topicId: 't1',
        name: `Concept ${i}`,
        definition: 'd',
        difficulty: 'BEGINNER',
        objectives: [],
      })),
      relationships: [],
    })
    listMasteryForCourse.mockResolvedValue([])
    const { GET } = await import('@/app/api/recommendations/route')
    const res = await GET(
      new Request(
        'http://t/api/recommendations?courseSlug=generative-ai&limit=2',
      ),
    )
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/progress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/progress/route.ts`**

```ts
import { handle, ok } from '@/lib/api'
import { getAllCourseProgress } from '@/lib/repositories/progress'
import { ensureDemoUser } from '@/lib/repositories/assessment'

export async function GET() {
  return handle(async () => {
    const user = await ensureDemoUser()
    const progress = await getAllCourseProgress(user.id)
    return ok(progress)
  })
}
```

- [ ] **Step 4: Create `app/api/recommendations/route.ts`**

```ts
import { z } from 'zod'
import { ApiError, handle, ok } from '@/lib/api'
import { recommend } from '@/lib/adaptive'
import { getCourseGraph } from '@/lib/repositories/concept'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { ensureDemoUser } from '@/lib/repositories/assessment'

const limitSchema = z.coerce.number().int().min(1).max(20).default(6)

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams
    const courseSlug = params.get('courseSlug')

    if (!courseSlug) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'courseSlug query parameter is required',
        400,
      )
    }

    const parsedLimit = limitSchema.safeParse(params.get('limit') ?? undefined)
    const limit = parsedLimit.success ? parsedLimit.data : 6

    const graph = await getCourseGraph(courseSlug)
    if (!graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${courseSlug}"`, 404)
    }

    const user = await ensureDemoUser()
    const mastery = await listMasteryForCourse(user.id, courseSlug)

    return ok(recommend(graph, mastery, courseSlug, limit))
  })
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/api/progress.test.ts`
Expected: PASS — `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add app/api/progress app/api/recommendations tests/api/progress.test.ts
git commit -m "feat(api): add progress and recommendation endpoints"
```

---

## Task 6: Progress components

**Files:**
- Create: `components/mastery-bar.tsx`
- Create: `components/recommendation-card.tsx`
- Create: `components/course-progress-card.tsx`
- Test: `tests/components/recommendation-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/recommendation-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecommendationCard } from '@/components/recommendation-card'
import type { Recommendation } from '@/lib/schemas/recommendation'

const base: Recommendation = {
  conceptId: 'c1',
  conceptName: 'Attention',
  courseSlug: 'generative-ai',
  topicId: 't1',
  action: 'LEARN',
  reason: 'You have not started this yet and its prerequisites are covered.',
  priority: 50,
  masteryScore: 0,
}

describe('RecommendationCard', () => {
  it('renders the concept name', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('renders the reason', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(
      screen.getByText(
        'You have not started this yet and its prerequisites are covered.',
      ),
    ).toBeInTheDocument()
  })

  it('renders a Learn label for a LEARN action', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByText('Learn')).toBeInTheDocument()
  })

  it('renders a Practise label for a PRACTISE action', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'PRACTISE', masteryScore: 70 }}
      />,
    )
    expect(screen.getByText('Practise')).toBeInTheDocument()
  })

  it('renders a Review label for a REVIEW action', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'REVIEW', masteryScore: 30 }}
      />,
    )
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('links to the learn page when a topicId is present', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/learn/generative-ai/t1',
    )
  })

  it('links to the course page when there is no topicId', () => {
    render(<RecommendationCard recommendation={{ ...base, topicId: null }} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/courses/generative-ai',
    )
  })

  it('shows the current mastery score for a started concept', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'PRACTISE', masteryScore: 70 }}
      />,
    )
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('hides the score for an unstarted concept', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/recommendation-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/mastery-bar.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { MasteryStatus } from '@/lib/schemas/common'

const STATUS_LABEL: Record<MasteryStatus, string> = {
  NOT_STARTED: 'Not started',
  LEARNING: 'Learning',
  PRACTICING: 'Practising',
  MASTERED: 'Mastered',
  NEEDS_REVIEW: 'Needs review',
}

const STATUS_COLOUR: Record<MasteryStatus, string> = {
  NOT_STARTED: 'text-muted-foreground',
  LEARNING: 'text-amber-600 dark:text-amber-400',
  PRACTICING: 'text-blue-600 dark:text-blue-400',
  MASTERED: 'text-emerald-600 dark:text-emerald-400',
  NEEDS_REVIEW: 'text-destructive',
}

export function MasteryBar({
  name,
  score,
  status,
}: {
  name: string
  score: number
  status: MasteryStatus
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{name}</span>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            STATUS_COLOUR[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <Progress value={score} className="h-1.5" />
    </div>
  )
}
```

- [ ] **Step 4: Create `components/recommendation-card.tsx`**

```tsx
import Link from 'next/link'
import { ArrowRight, BookOpen, RotateCcw, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  LearningAction,
  Recommendation,
} from '@/lib/schemas/recommendation'

const ACTION_LABEL: Record<LearningAction, string> = {
  LEARN: 'Learn',
  PRACTISE: 'Practise',
  REVIEW: 'Review',
}

const ACTION_ICON: Record<LearningAction, typeof BookOpen> = {
  LEARN: BookOpen,
  PRACTISE: Target,
  REVIEW: RotateCcw,
}

const ACTION_ACCENT: Record<LearningAction, string> = {
  LEARN: 'border-l-blue-500',
  PRACTISE: 'border-l-amber-500',
  REVIEW: 'border-l-destructive',
}

export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation
}) {
  const Icon = ACTION_ICON[recommendation.action]
  const href = recommendation.topicId
    ? `/learn/${recommendation.courseSlug}/${recommendation.topicId}`
    : `/courses/${recommendation.courseSlug}`

  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          'flex flex-row items-start gap-4 border-l-4 p-4 transition-colors group-hover:border-primary/50',
          ACTION_ACCENT[recommendation.action],
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon data-icon className="size-4" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recommendation.conceptName}</span>
            <Badge variant="secondary" className="text-xs">
              {ACTION_LABEL[recommendation.action]}
            </Badge>
            {recommendation.masteryScore > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {recommendation.masteryScore}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {recommendation.reason}
          </p>
        </div>

        <ArrowRight
          data-icon
          className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Card>
    </Link>
  )
}
```

- [ ] **Step 5: Create `components/course-progress-card.tsx`**

```tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { CourseProgress } from '@/lib/schemas/recommendation'

export function CourseProgressCard({
  progress,
}: {
  progress: CourseProgress
}) {
  const completion =
    progress.totalConcepts === 0
      ? 0
      : Math.round((progress.masteredConcepts / progress.totalConcepts) * 100)

  return (
    <Link
      href={`/courses/${progress.courseSlug}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">
              {progress.courseTitle}
            </CardTitle>
            {progress.startedConcepts === 0 && (
              <Badge variant="outline">Not started</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.masteredConcepts} of {progress.totalConcepts} mastered
            </span>
            <span className="font-medium tabular-nums">{completion}%</span>
          </div>
          <Progress value={completion} />
          {progress.startedConcepts > 0 && (
            <p className="text-xs text-muted-foreground">
              Average mastery across started concepts:{' '}
              <span className="tabular-nums">{progress.averageMastery}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/components/recommendation-card.test.tsx`
Expected: PASS — `9 passed`.

- [ ] **Step 7: Commit**

```bash
git add components/mastery-bar.tsx components/recommendation-card.tsx components/course-progress-card.tsx tests/components/recommendation-card.test.tsx
git commit -m "feat(ui): add mastery bar, recommendation card and progress card"
```

---

## Task 7: Progress dashboard

**Files:**
- Create: `app/progress/page.tsx`
- Create: `app/progress/loading.tsx`

- [ ] **Step 1: Create `app/progress/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/progress/page.tsx`**

Recommendations are computed for the course with the most recent activity. A learner with no activity gets recommendations from the first course so the page is never empty.

```tsx
import { Compass, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { CourseProgressCard } from '@/components/course-progress-card'
import { RecommendationCard } from '@/components/recommendation-card'
import { MasteryBar } from '@/components/mastery-bar'
import { getAllCourseProgress } from '@/lib/repositories/progress'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { getCourseGraph } from '@/lib/repositories/concept'
import { ensureDemoUser } from '@/lib/repositories/assessment'
import { recommend } from '@/lib/adaptive'
import { generateCoachSummary } from '@/lib/ai/coach'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your progress — Adaptive',
}

export default async function ProgressPage() {
  const user = await ensureDemoUser()
  const progress = await getAllCourseProgress(user.id)

  const active =
    progress
      .filter((p) => p.lastActivityAt !== null)
      .sort((a, b) =>
        (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''),
      )[0] ?? progress[0]

  if (!active) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass data-icon />
          </EmptyMedia>
          <EmptyTitle>No courses available</EmptyTitle>
          <EmptyDescription>
            Seed the database, then come back.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const [graph, mastery] = await Promise.all([
    getCourseGraph(active.courseSlug),
    listMasteryForCourse(user.id, active.courseSlug),
  ])

  const recommendations = graph
    ? recommend(graph, mastery, active.courseSlug, 5)
    : []

  const totals = progress.reduce(
    (acc, p) => ({
      mastered: acc.mastered + p.masteredConcepts,
      started: acc.started + p.startedConcepts,
      total: acc.total + p.totalConcepts,
    }),
    { mastered: 0, started: 0, total: 0 },
  )

  const summary = await generateCoachSummary({
    masteredCount: totals.mastered,
    startedCount: totals.started,
    totalCount: totals.total,
    topRecommendations: recommendations.slice(0, 3).map((r) => ({
      conceptName: r.conceptName,
      action: r.action,
    })),
  })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="text-sm text-muted-foreground">
          Mastery is measured from your assessment answers, not from pages
          visited.
        </p>
      </header>

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <Sparkles data-icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{summary.headline}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.body}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">What to do next</h2>
          <span className="text-sm text-muted-foreground">
            {active.courseTitle}
          </span>
        </div>

        {recommendations.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles data-icon />
              </EmptyMedia>
              <EmptyTitle>Nothing outstanding</EmptyTitle>
              <EmptyDescription>
                You have mastered everything available in this course. Pick
                another one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/explore" />}>Explore courses</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.conceptId}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Courses</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((item) => (
            <CourseProgressCard key={item.courseSlug} progress={item} />
          ))}
        </div>
      </section>

      {mastery.length > 0 && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Concept mastery in {active.courseTitle}
            </h2>
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                {mastery.map((record) => (
                  <MasteryBar
                    key={record.conceptId}
                    name={record.conceptName}
                    score={record.masteryScore}
                    status={record.status}
                  />
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Smoke-test with no activity**

Reset mastery so the page renders a clean-slate state:

```bash
npx prisma db execute --stdin <<< "DELETE FROM Mastery;"
```

Run: `npm run dev`, open `/progress`.
Expected: a coach card, a **What to do next** list containing only root concepts (those with no prerequisites — Tokenization, the prompting basics, the security foundations), all labelled **Learn**. Three course cards showing 0% and a **Not started** badge. No concept mastery section.

- [ ] **Step 4: Smoke-test after an assessment**

Go to `/learn/generative-ai/<topicId>`, click **Test yourself**, answer deliberately badly, and submit. Then return to `/progress`.

Expected: the recommendations have changed. The concepts you failed now appear at the top labelled **Review**, with a reason naming the score and what they block. The concept mastery section now lists them with red **Needs review** status.

- [ ] **Step 5: Verify readiness gating**

Check that a deep concept — for example `Retrieval-Augmented Generation`, which sits behind several prerequisites — does **not** appear in the list while its prerequisites are unmastered.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/progress
git commit -m "feat(adaptive): add progress dashboard with ranked recommendations"
```

---

## Phase 7 Exit Checklist

- [ ] A brand new learner is only recommended concepts with no unmet prerequisites
- [ ] A concept whose prerequisite is below 65 never appears
- [ ] A mastered concept drops out of the recommendation list
- [ ] REVIEW outranks PRACTISE, which outranks LEARN
- [ ] Every recommendation carries a specific reason naming the concept
- [ ] Recommendations visibly change after submitting an assessment
- [ ] Course progress correctly separates started, mastered and total counts
- [ ] Coach summary degrades to deterministic text when the model is unavailable
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-08-auth-admin.md`](./phase-08-auth-admin.md).
