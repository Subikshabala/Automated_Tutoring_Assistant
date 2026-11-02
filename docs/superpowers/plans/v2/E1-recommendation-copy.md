# E1 — Recommendation Copy

**Depends on:** A1. **Blocks:** nothing.

**Problem:** the Progress page shows four cards whose reasons are the same sentence with the nouns swapped.

```
You have not started ReAct Pattern and its prerequisites are covered. It opens up Tool Calling.
You have not started Agent Memory and its prerequisites are covered. It opens up Agent Handoff.
You have not started Task Decomposition and its prerequisites are covered. It opens up Orchestrator-Worker Pattern.
You have not started Reflection and its prerequisites are covered.
```

Reading four of those in a column makes the whole feature feel mechanical — which is exactly what the user flagged.

**Cause:** `reasonFor()` in `lib/adaptive.ts` has one template per action and no awareness of context. A brand-new learner sees the LEARN branch four times in a row.

**Decision:** keep it deterministic — no model call for something this small — but make the reason depend on *why this concept is being recommended now*, not just its action. Different situations get genuinely different sentences.

---

## Task 1: Situation classification

**File:** modify `lib/adaptive.ts`, test `tests/lib/adaptive.test.ts`

The useful distinction is not LEARN vs PRACTISE. It is:

| Situation | Condition | What to say |
|---|---|---|
| `FIRST_STEP` | No prerequisites, learner has nothing started | Where to begin |
| `NEWLY_UNLOCKED` | Prerequisites just reached mastery | What opened this up |
| `READY` | Unstarted, prerequisites met, not newly so | Plain availability |
| `GATEWAY` | Unstarted and unlocks 3+ concepts | Leverage |
| `NEARLY_THERE` | Score 65–79 | How close |
| `SHAKY` | Score 50–64 | Partial grasp |
| `BLOCKED_DOWNSTREAM` | Score < 50 **and** unlocks something | What it is holding up |
| `FOUNDATIONAL_GAP` | Score < 50, nothing downstream | Fix it for itself |

- [ ] **Step 1: Write the failing test**

```ts
import { classifySituation, reasonFor } from '@/lib/adaptive'

describe('classifySituation', () => {
  it('calls the very first concept FIRST_STEP', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 0, unlocksCount: 1, prerequisiteCount: 0,
      }),
    ).toBe('FIRST_STEP')
  })

  it('calls a high-leverage unstarted concept GATEWAY', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 5, unlocksCount: 3, prerequisiteCount: 1,
      }),
    ).toBe('GATEWAY')
  })

  it('calls an ordinary unstarted concept READY', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 5, unlocksCount: 1, prerequisiteCount: 1,
      }),
    ).toBe('READY')
  })

  it('calls 65-79 NEARLY_THERE', () => {
    expect(
      classifySituation({
        score: 72, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('NEARLY_THERE')
  })

  it('calls 50-64 SHAKY', () => {
    expect(
      classifySituation({
        score: 58, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('SHAKY')
  })

  it('calls a weak concept with dependents BLOCKED_DOWNSTREAM', () => {
    expect(
      classifySituation({
        score: 30, started: true, totalStarted: 3, unlocksCount: 2, prerequisiteCount: 0,
      }),
    ).toBe('BLOCKED_DOWNSTREAM')
  })

  it('calls a weak leaf concept FOUNDATIONAL_GAP', () => {
    expect(
      classifySituation({
        score: 30, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('FOUNDATIONAL_GAP')
  })
})

describe('reasonFor variety', () => {
  const base = {
    conceptName: 'Attention', score: 0, unlocks: [], prerequisites: [], index: 0,
  }

  it('writes a distinct sentence per situation', () => {
    const sentences = new Set([
      reasonFor('FIRST_STEP', base),
      reasonFor('GATEWAY', { ...base, unlocks: ['A', 'B', 'C'] }),
      reasonFor('READY', base),
      reasonFor('NEARLY_THERE', { ...base, score: 72 }),
      reasonFor('SHAKY', { ...base, score: 58 }),
      reasonFor('BLOCKED_DOWNSTREAM', { ...base, score: 30, unlocks: ['X'] }),
      reasonFor('FOUNDATIONAL_GAP', { ...base, score: 30 }),
    ])
    expect(sentences.size).toBe(7)
  })

  it('varies phrasing for repeated situations in one list', () => {
    const first = reasonFor('READY', { ...base, index: 0 })
    const second = reasonFor('READY', { ...base, conceptName: 'Embeddings', index: 1 })
    const third = reasonFor('READY', { ...base, conceptName: 'Tokenization', index: 2 })
    expect(new Set([first, second, third]).size).toBe(3)
  })

  it('names the concept', () => {
    expect(reasonFor('READY', base)).toContain('Attention')
  })

  it('names what is unlocked when relevant', () => {
    const r = reasonFor('GATEWAY', { ...base, unlocks: ['Tool Calling', 'Guardrails', 'Reflection'] })
    expect(r).toContain('Tool Calling')
  })

  it('names the prerequisite that just cleared', () => {
    const r = reasonFor('NEWLY_UNLOCKED', { ...base, prerequisites: ['ReAct Pattern'] })
    expect(r).toContain('ReAct Pattern')
  })

  it('includes the score where it is informative', () => {
    expect(reasonFor('NEARLY_THERE', { ...base, score: 72 })).toContain('72')
  })

  it('omits the score for unstarted concepts', () => {
    expect(reasonFor('READY', base)).not.toContain('0')
  })

  it('never exceeds two sentences', () => {
    for (const s of ['FIRST_STEP', 'GATEWAY', 'READY', 'NEARLY_THERE', 'SHAKY', 'BLOCKED_DOWNSTREAM', 'FOUNDATIONAL_GAP'] as const) {
      const sentences = reasonFor(s, { ...base, score: 50, unlocks: ['X'], prerequisites: ['Y'] })
        .split(/[.!?]\s/)
        .filter(Boolean)
      expect(sentences.length).toBeLessThanOrEqual(2)
    }
  })
})
```

- [ ] **Step 2: Implement the classifier**

```ts
export type Situation =
  | 'FIRST_STEP'
  | 'NEWLY_UNLOCKED'
  | 'READY'
  | 'GATEWAY'
  | 'NEARLY_THERE'
  | 'SHAKY'
  | 'BLOCKED_DOWNSTREAM'
  | 'FOUNDATIONAL_GAP'

export type SituationInput = {
  score: number
  started: boolean
  /** How many concepts the learner has touched in this course. */
  totalStarted: number
  unlocksCount: number
  prerequisiteCount: number
  /** True when every prerequisite crossed the threshold on the last attempt. */
  justUnlocked?: boolean
}

/** Unlocking this many concepts makes a concept worth calling out. */
const GATEWAY_THRESHOLD = 3

export function classifySituation(input: SituationInput): Situation {
  if (!input.started) {
    if (input.totalStarted === 0 && input.prerequisiteCount === 0) {
      return 'FIRST_STEP'
    }
    if (input.justUnlocked) return 'NEWLY_UNLOCKED'
    if (input.unlocksCount >= GATEWAY_THRESHOLD) return 'GATEWAY'
    return 'READY'
  }

  if (input.score >= 65) return 'NEARLY_THERE'
  if (input.score >= 50) return 'SHAKY'
  return input.unlocksCount > 0 ? 'BLOCKED_DOWNSTREAM' : 'FOUNDATIONAL_GAP'
}
```

- [ ] **Step 3: Implement varied copy**

Each situation gets several phrasings, picked by list position so two adjacent cards never read the same.

```ts
export type ReasonInput = {
  conceptName: string
  score: number
  unlocks: string[]
  prerequisites: string[]
  /** Position in the recommendation list, used to vary phrasing. */
  index: number
}

function list(names: string[], limit = 2): string {
  const taken = names.slice(0, limit)
  if (taken.length === 0) return ''
  if (taken.length === 1) return taken[0]
  return `${taken.slice(0, -1).join(', ')} and ${taken[taken.length - 1]}`
}

type Phrasing = (i: ReasonInput) => string

const PHRASINGS: Record<Situation, Phrasing[]> = {
  FIRST_STEP: [
    (i) => `Start here. ${i.conceptName} has no prerequisites, and most of this course builds on it.`,
    (i) => `${i.conceptName} is the entry point — nothing else needs to come first.`,
  ],

  NEWLY_UNLOCKED: [
    (i) => `You just cleared ${list(i.prerequisites)}, which opens ${i.conceptName}.`,
    (i) => `${i.conceptName} is now available — ${list(i.prerequisites)} is solid enough to build on.`,
  ],

  GATEWAY: [
    (i) => `${i.conceptName} unlocks ${i.unlocks.length} later concepts, including ${list(i.unlocks)}. Worth doing before the others.`,
    (i) => `A lot depends on ${i.conceptName} — ${list(i.unlocks)} and more sit behind it.`,
  ],

  READY: [
    (i) => `${i.conceptName} is open. Its prerequisites are covered.`,
    (i) => `Nothing is blocking ${i.conceptName}${i.unlocks.length > 0 ? `, and it leads into ${list(i.unlocks, 1)}` : ''}.`,
    (i) => `You can take ${i.conceptName} next whenever you want.`,
  ],

  NEARLY_THERE: [
    (i) => `${i.score} on ${i.conceptName}. One more set of questions should finish it.`,
    (i) => `${i.conceptName} is close — ${i.score} out of 100. The gap is small.`,
  ],

  SHAKY: [
    (i) => `${i.score} on ${i.conceptName} suggests the shape is there but the detail is not.`,
    (i) => `You are halfway on ${i.conceptName} at ${i.score}. Another pass should settle it.`,
  ],

  BLOCKED_DOWNSTREAM: [
    (i) => `${i.conceptName} is at ${i.score}, and ${list(i.unlocks)} depends on it. Worth fixing before moving on.`,
    (i) => `${list(i.unlocks)} will be harder while ${i.conceptName} sits at ${i.score}.`,
  ],

  FOUNDATIONAL_GAP: [
    (i) => `${i.score} on ${i.conceptName}. Reread the explanation before trying more questions.`,
    (i) => `${i.conceptName} has not landed yet — ${i.score} out of 100.`,
  ],
}

export function reasonFor(situation: Situation, input: ReasonInput): string {
  const options = PHRASINGS[situation]
  return options[input.index % options.length](input)
}
```

- [ ] **Step 4: Rewire `recommend`**

```ts
  const startedCount = startedConcepts.size
  const prerequisiteCount = (id: string) =>
    graph.relationships.filter(
      (r) => r.type === 'PREREQUISITE_OF' && r.toId === id,
    ).length

  const recommendations: Recommendation[] = []

  for (const concept of graph.concepts) {
    // ... existing score / started / skip logic ...

    const unlocks = unlocksByConcept.get(concept.id) ?? []
    const prerequisites = prerequisiteNames(concept.id)

    const situation = classifySituation({
      score,
      started,
      totalStarted: startedCount,
      unlocksCount: unlocks.length,
      prerequisiteCount: prerequisiteCount(concept.id),
    })

    recommendations.push({
      conceptId: concept.id,
      conceptName: concept.name,
      courseSlug,
      topicId: concept.topicId ?? null,
      action: actionFor(score, started),
      situation,
      // Index assigned after sorting, below.
      reason: '',
      priority: priorityFor(actionFor(score, started), score, unlocks.length),
      masteryScore: score,
      unlocks,
      prerequisites,
    })
  }

  // Sort first, then write reasons — phrasing varies by final position.
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((rec, index) => ({
      ...rec,
      reason: reasonFor(rec.situation, {
        conceptName: rec.conceptName,
        score: rec.masteryScore,
        unlocks: rec.unlocks,
        prerequisites: rec.prerequisites,
        index,
      }),
    }))
```

Add a `prerequisiteNames` helper mirroring `unlocksByConcept`.

- [ ] **Step 5: Extend the schema**

In `lib/schemas/recommendation.ts`:

```ts
export const situationSchema = z.enum([
  'FIRST_STEP',
  'NEWLY_UNLOCKED',
  'READY',
  'GATEWAY',
  'NEARLY_THERE',
  'SHAKY',
  'BLOCKED_DOWNSTREAM',
  'FOUNDATIONAL_GAP',
])

export const recommendationSchema = z.object({
  // ... existing fields ...
  situation: situationSchema,
  unlocks: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
})
```

- [ ] **Step 6: Tests pass, commit**

```bash
npx vitest run tests/lib/adaptive.test.ts --fileParallelism=false
git add lib/adaptive.ts lib/schemas/recommendation.ts tests/lib/adaptive.test.ts
git commit -m "feat(adaptive): situation-aware recommendation copy"
```

---

## Task 2: Surface the situation

**File:** modify `components/recommendation-card.tsx`

The badge currently repeats the action, which the icon already conveys.

- [ ] **Step 1: Label by situation**

```tsx
const SITUATION_LABEL: Record<Situation, string> = {
  FIRST_STEP: 'Start here',
  NEWLY_UNLOCKED: 'Just unlocked',
  READY: 'Ready',
  GATEWAY: 'High leverage',
  NEARLY_THERE: 'Almost there',
  SHAKY: 'Needs another pass',
  BLOCKED_DOWNSTREAM: 'Blocking others',
  FOUNDATIONAL_GAP: 'Revisit',
}

const SITUATION_VARIANT: Record<Situation, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  FIRST_STEP: 'default',
  NEWLY_UNLOCKED: 'default',
  READY: 'secondary',
  GATEWAY: 'default',
  NEARLY_THERE: 'secondary',
  SHAKY: 'outline',
  BLOCKED_DOWNSTREAM: 'destructive',
  FOUNDATIONAL_GAP: 'destructive',
}
```

- [ ] **Step 2: Update the test**

`tests/components/recommendation-card.test.tsx` asserts on `Learn` / `Practise` / `Review`. Replace with the new labels and add a `situation` field to the fixture.

---

## Task 3: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Compare before and after**

Clear mastery and open `/progress`:

```bash
npx prisma db execute --stdin <<< "DELETE FROM Mastery;"
```

Expected: the first card reads **Start here**, the rest vary — no two identical sentence shapes in a row.

Then take an assessment and fail it deliberately. Expected: the failed concepts move to the top with **Blocking others** or **Revisit**, and the reason names what they are holding up.

- [ ] **Step 3: Commit**

```bash
git add components/recommendation-card.tsx tests/components/recommendation-card.test.tsx
git commit -m "feat(ui): label recommendations by situation rather than action"
```

---

## Exit checklist

- [ ] Four consecutive recommendations read differently
- [ ] The first concept for a new learner says **Start here**
- [ ] A high-leverage concept is called out as such
- [ ] A weak concept names what it is blocking
- [ ] Scores appear only where informative
- [ ] No reason exceeds two sentences
- [ ] All verification commands pass

Next: [`E2-curriculum-accordion.md`](./E2-curriculum-accordion.md).
