# Phase 6 — Student Concept Maps

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner draws their own concept map for a course — adding nodes, naming them, connecting them — saves it, then compares it against the canonical map and receives specific feedback on what they got right, what they missed, and what they connected wrongly.

**Architecture:** The comparison algorithm is pure and deterministic: normalise labels, fuzzy-match student nodes to canonical concepts, diff the edge sets, classify each difference. Only the final narrative feedback goes to Gemini, and it receives the already-computed diff rather than raw maps — so the model shapes the wording, not the verdict. This keeps the assessment reproducible.

**Tech Stack:** `@xyflow/react` · Gemini · Zod · Prisma · shadcn/ui

**Depends on:** Phase 2 complete (canonical graph and React Flow setup exist).

**Done when:** `/courses/<slug>/my-map` lets a learner build and save a map, and comparing it produces an accurate structural diff plus readable feedback.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/schemas/student-map.ts` | Map save and comparison contracts |
| `lib/map-compare.ts` | Pure normalise / match / diff algorithm |
| `lib/repositories/student-map.ts` | Student map persistence |
| `lib/ai/map-feedback.ts` | Narrative feedback from a computed diff |
| `app/api/concept-maps/route.ts` | `POST` save, `GET` list |
| `app/api/concept-maps/[id]/route.ts` | `GET` one, `DELETE` |
| `app/api/concept-maps/[id]/compare/route.ts` | `POST` compare against canonical |
| `components/map-editor.tsx` | Editable React Flow canvas |
| `components/map-toolbar.tsx` | Add node, save, compare controls |
| `components/map-comparison.tsx` | Diff result display |
| `app/courses/[slug]/my-map/page.tsx` | Student map page |

---

## Task 1: Student map schemas

**Files:**
- Create: `lib/schemas/student-map.ts`
- Test: `tests/lib/schemas-student-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-student-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  mapFeedbackSchema,
  saveMapSchema,
  studentEdgeSchema,
  studentNodeSchema,
} from '@/lib/schemas/student-map'

describe('studentNodeSchema', () => {
  it('accepts a well formed node', () => {
    const parsed = studentNodeSchema.parse({
      id: 'n1',
      label: 'Tokenization',
      x: 10,
      y: 20,
    })
    expect(parsed.label).toBe('Tokenization')
  })

  it('rejects an empty label', () => {
    expect(
      studentNodeSchema.safeParse({ id: 'n1', label: '', x: 0, y: 0 }).success,
    ).toBe(false)
  })

  it('rejects a label over 80 characters', () => {
    expect(
      studentNodeSchema.safeParse({
        id: 'n1',
        label: 'a'.repeat(81),
        x: 0,
        y: 0,
      }).success,
    ).toBe(false)
  })

  it('defaults coordinates to zero', () => {
    const parsed = studentNodeSchema.parse({ id: 'n1', label: 'X' })
    expect(parsed.x).toBe(0)
    expect(parsed.y).toBe(0)
  })
})

describe('studentEdgeSchema', () => {
  it('accepts a well formed edge', () => {
    const parsed = studentEdgeSchema.parse({
      id: 'e1',
      fromId: 'n1',
      toId: 'n2',
      type: 'PREREQUISITE_OF',
    })
    expect(parsed.type).toBe('PREREQUISITE_OF')
  })

  it('defaults the type to RELATED_TO', () => {
    const parsed = studentEdgeSchema.parse({
      id: 'e1',
      fromId: 'n1',
      toId: 'n2',
    })
    expect(parsed.type).toBe('RELATED_TO')
  })

  it('rejects an unknown relationship type', () => {
    expect(
      studentEdgeSchema.safeParse({
        id: 'e1',
        fromId: 'n1',
        toId: 'n2',
        type: 'CAUSES',
      }).success,
    ).toBe(false)
  })
})

describe('saveMapSchema', () => {
  const valid = {
    courseSlug: 'generative-ai',
    title: 'My first attempt',
    nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
    edges: [],
  }

  it('accepts a map with one node and no edges', () => {
    expect(saveMapSchema.parse(valid).nodes).toHaveLength(1)
  })

  it('rejects a map with no nodes', () => {
    expect(saveMapSchema.safeParse({ ...valid, nodes: [] }).success).toBe(false)
  })

  it('rejects a map with more than 60 nodes', () => {
    const nodes = Array.from({ length: 61 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      x: 0,
      y: 0,
    }))
    expect(saveMapSchema.safeParse({ ...valid, nodes }).success).toBe(false)
  })

  it('rejects an edge referencing a node not in the map', () => {
    const result = saveMapSchema.safeParse({
      ...valid,
      edges: [{ id: 'e1', fromId: 'n1', toId: 'ghost', type: 'RELATED_TO' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts an edge between two present nodes', () => {
    const result = saveMapSchema.safeParse({
      ...valid,
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0 },
        { id: 'n2', label: 'B', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('mapFeedbackSchema', () => {
  it('accepts a well formed feedback object', () => {
    const parsed = mapFeedbackSchema.parse({
      summary: 'A solid first map with one structural gap.',
      strengths: ['You linked tokenization to embeddings correctly.'],
      gaps: ['The context window is missing.'],
      nextStep: 'Read the context window concept, then add it.',
    })
    expect(parsed.strengths).toHaveLength(1)
  })

  it('defaults the list fields to empty arrays', () => {
    const parsed = mapFeedbackSchema.parse({
      summary: 's',
      nextStep: 'n',
    })
    expect(parsed.strengths).toEqual([])
    expect(parsed.gaps).toEqual([])
  })

  it('rejects an empty summary', () => {
    expect(
      mapFeedbackSchema.safeParse({ summary: '', nextStep: 'n' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-student-map.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/student-map'`.

- [ ] **Step 3: Create `lib/schemas/student-map.ts`**

```ts
import { z } from 'zod'
import { idSchema, slugSchema } from './common'
import { relationshipTypeSchema } from './concept'

export const studentNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  x: z.number().default(0),
  y: z.number().default(0),
})

export const studentEdgeSchema = z.object({
  id: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: relationshipTypeSchema.default('RELATED_TO'),
})

export const saveMapSchema = z
  .object({
    id: idSchema.optional(),
    courseSlug: slugSchema,
    title: z.string().min(1).max(120),
    nodes: z.array(studentNodeSchema).min(1).max(60),
    edges: z.array(studentEdgeSchema).max(200).default([]),
  })
  .refine(
    (map) => {
      const ids = new Set(map.nodes.map((n) => n.id))
      return map.edges.every((e) => ids.has(e.fromId) && ids.has(e.toId))
    },
    {
      message: 'Every edge must connect two nodes present in the map',
      path: ['edges'],
    },
  )

export const mapFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  nextStep: z.string().min(1),
})

export type StudentNode = z.infer<typeof studentNodeSchema>
export type StudentEdge = z.infer<typeof studentEdgeSchema>
export type SaveMapInput = z.infer<typeof saveMapSchema>
export type MapFeedback = z.infer<typeof mapFeedbackSchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-student-map.test.ts`
Expected: PASS — `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/student-map.ts tests/lib/schemas-student-map.test.ts
git commit -m "feat(student-map): add zod contracts for map save and feedback"
```

---

## Task 2: Comparison algorithm

The heart of the phase. Pure, deterministic, and heavily tested — the feedback a learner receives is only as trustworthy as this function.

**Files:**
- Create: `lib/map-compare.ts`
- Test: `tests/lib/map-compare.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/map-compare.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { compareMaps, matchLabel, normaliseLabel } from '@/lib/map-compare'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name: string) {
  return {
    id,
    courseId: 'c1',
    name,
    definition: 'd',
    difficulty: 'BEGINNER' as const,
    objectives: [],
  }
}

const canonical: ConceptGraph = {
  concepts: [
    concept('c-tok', 'Tokenization'),
    concept('c-emb', 'Embeddings'),
    concept('c-att', 'Attention'),
  ],
  relationships: [
    { id: 'r1', fromId: 'c-tok', toId: 'c-emb', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r2', fromId: 'c-emb', toId: 'c-att', type: 'PREREQUISITE_OF', strength: 1 },
  ],
}

describe('normaliseLabel', () => {
  it('lowercases and trims', () => {
    expect(normaliseLabel('  Tokenization  ')).toBe('tokenization')
  })

  it('collapses internal whitespace', () => {
    expect(normaliseLabel('context   window')).toBe('context window')
  })

  it('strips punctuation', () => {
    expect(normaliseLabel('self-attention!')).toBe('selfattention')
  })
})

describe('matchLabel', () => {
  const names = ['Tokenization', 'Embeddings', 'Context Window']

  it('matches an exact label', () => {
    expect(matchLabel('Tokenization', names)).toBe('Tokenization')
  })

  it('matches ignoring case', () => {
    expect(matchLabel('tokenization', names)).toBe('Tokenization')
  })

  it('matches ignoring punctuation and spacing', () => {
    expect(matchLabel('context-window', names)).toBe('Context Window')
  })

  it('matches a near miss with one typo', () => {
    expect(matchLabel('Tokenisation', names)).toBe('Tokenization')
  })

  it('returns null for an unrelated label', () => {
    expect(matchLabel('Quantum Entanglement', names)).toBeNull()
  })

  it('does not match a short label to a long one', () => {
    expect(matchLabel('To', names)).toBeNull()
  })
})

describe('compareMaps', () => {
  it('reports a perfect map as fully correct', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' },
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'PREREQUISITE_OF' },
      ],
    })
    expect(result.matchedConcepts).toHaveLength(3)
    expect(result.missingConcepts).toHaveLength(0)
    expect(result.correctEdges).toHaveLength(2)
    expect(result.missingEdges).toHaveLength(0)
    expect(result.incorrectEdges).toHaveLength(0)
    expect(result.score).toBe(100)
  })

  it('reports concepts the learner omitted', () => {
    const result = compareMaps(canonical, {
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(result.missingConcepts).toEqual(['Embeddings', 'Attention'])
  })

  it('reports nodes that match no canonical concept', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Blockchain Consensus', x: 0, y: 0 },
      ],
      edges: [],
    })
    expect(result.unrecognisedNodes).toEqual(['Blockchain Consensus'])
  })

  it('reports an edge the learner drew that does not exist canonically', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' }],
    })
    expect(result.incorrectEdges).toEqual([
      { from: 'Tokenization', to: 'Attention' },
    ])
  })

  it('reports canonical edges the learner did not draw', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' }],
    })
    expect(result.missingEdges).toEqual([
      { from: 'Embeddings', to: 'Attention' },
    ])
  })

  it('credits an edge drawn with the wrong relationship type as present but mistyped', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.correctEdges).toHaveLength(1)
    expect(result.mistypedEdges).toEqual([
      { from: 'Tokenization', to: 'Embeddings', drew: 'RELATED_TO', expected: 'PREREQUISITE_OF' },
    ])
  })

  it('scores an empty-ish map low', () => {
    const result = compareMaps(canonical, {
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(result.score).toBeLessThan(40)
  })

  it('never returns a score above 100', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
        { id: 'n2', label: 'Embeddings', x: 0, y: 0 },
        { id: 'n3', label: 'Attention', x: 0, y: 0 },
      ],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' },
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'PREREQUISITE_OF' },
      ],
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('handles a canonical graph with no relationships', () => {
    const result = compareMaps(
      { concepts: [concept('c1', 'Solo')], relationships: [] },
      { nodes: [{ id: 'n1', label: 'Solo', x: 0, y: 0 }], edges: [] },
    )
    expect(result.score).toBe(100)
  })

  it('ignores an edge between two unrecognised nodes', () => {
    const result = compareMaps(canonical, {
      nodes: [
        { id: 'n1', label: 'Nonsense A', x: 0, y: 0 },
        { id: 'n2', label: 'Nonsense B', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', fromId: 'n1', toId: 'n2', type: 'RELATED_TO' }],
    })
    expect(result.incorrectEdges).toEqual([])
    expect(result.unrecognisedNodes).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/map-compare.test.ts`
Expected: FAIL — `Cannot find module '@/lib/map-compare'`.

- [ ] **Step 3: Create `lib/map-compare.ts`**

```ts
import type { ConceptGraph, RelationshipType } from '@/lib/schemas/concept'
import type { StudentEdge, StudentNode } from '@/lib/schemas/student-map'

export function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein distance, capped early for performance on long strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    previous = current
  }

  return previous[b.length]
}

/**
 * Matches a learner label to a canonical concept name.
 * Exact normalised match wins; otherwise allows a small edit distance
 * proportional to the label length, so "Tokenisation" matches
 * "Tokenization" but "To" matches nothing.
 */
export function matchLabel(
  label: string,
  canonicalNames: string[],
): string | null {
  const target = normaliseLabel(label)
  if (target.length === 0) return null

  for (const name of canonicalNames) {
    if (normaliseLabel(name) === target) return name
  }

  const tolerance = Math.floor(target.length / 6) + 1

  let best: { name: string; distance: number } | null = null
  for (const name of canonicalNames) {
    const candidate = normaliseLabel(name)
    if (Math.abs(candidate.length - target.length) > tolerance) continue

    const distance = editDistance(target, candidate)
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { name, distance }
    }
  }

  return best?.name ?? null
}

export type EdgeRef = { from: string; to: string }

export type MistypedEdge = EdgeRef & {
  drew: RelationshipType
  expected: RelationshipType
}

export type MapComparison = {
  matchedConcepts: string[]
  missingConcepts: string[]
  unrecognisedNodes: string[]
  correctEdges: EdgeRef[]
  missingEdges: EdgeRef[]
  incorrectEdges: EdgeRef[]
  mistypedEdges: MistypedEdge[]
  score: number
}

const CONCEPT_WEIGHT = 0.5
const EDGE_WEIGHT = 0.5

export function compareMaps(
  canonical: ConceptGraph,
  student: { nodes: StudentNode[]; edges: StudentEdge[] },
): MapComparison {
  const canonicalNames = canonical.concepts.map((c) => c.name)
  const nameById = new Map(canonical.concepts.map((c) => [c.id, c.name]))

  // Student node id -> canonical concept name (or null if unrecognised).
  const matchByNodeId = new Map<string, string | null>()
  const matchedConcepts = new Set<string>()
  const unrecognisedNodes: string[] = []

  for (const node of student.nodes) {
    const match = matchLabel(node.label, canonicalNames)
    matchByNodeId.set(node.id, match)
    if (match) {
      matchedConcepts.add(match)
    } else {
      unrecognisedNodes.push(node.label)
    }
  }

  const missingConcepts = canonicalNames.filter(
    (name) => !matchedConcepts.has(name),
  )

  // Canonical edges keyed by "from||to" on concept names.
  const canonicalEdges = new Map<string, RelationshipType>()
  for (const rel of canonical.relationships) {
    const from = nameById.get(rel.fromId)
    const to = nameById.get(rel.toId)
    if (from && to) canonicalEdges.set(`${from}||${to}`, rel.type)
  }

  const correctEdges: EdgeRef[] = []
  const incorrectEdges: EdgeRef[] = []
  const mistypedEdges: MistypedEdge[] = []
  const drawnKeys = new Set<string>()

  for (const edge of student.edges) {
    const from = matchByNodeId.get(edge.fromId)
    const to = matchByNodeId.get(edge.toId)

    // An edge touching an unrecognised node cannot be judged.
    if (!from || !to) continue

    const key = `${from}||${to}`
    drawnKeys.add(key)

    const expected = canonicalEdges.get(key)
    if (expected) {
      correctEdges.push({ from, to })
      if (expected !== edge.type) {
        mistypedEdges.push({ from, to, drew: edge.type, expected })
      }
    } else {
      incorrectEdges.push({ from, to })
    }
  }

  const missingEdges: EdgeRef[] = []
  for (const key of canonicalEdges.keys()) {
    if (drawnKeys.has(key)) continue
    const [from, to] = key.split('||')
    missingEdges.push({ from, to })
  }

  const conceptRatio =
    canonicalNames.length === 0
      ? 1
      : matchedConcepts.size / canonicalNames.length

  const edgeRatio =
    canonicalEdges.size === 0 ? 1 : correctEdges.length / canonicalEdges.size

  const penalty =
    incorrectEdges.length > 0
      ? Math.min(0.2, incorrectEdges.length * 0.05)
      : 0

  const raw = conceptRatio * CONCEPT_WEIGHT + edgeRatio * EDGE_WEIGHT - penalty
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)))

  return {
    matchedConcepts: [...matchedConcepts],
    missingConcepts,
    unrecognisedNodes,
    correctEdges,
    missingEdges,
    incorrectEdges,
    mistypedEdges,
    score,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/map-compare.test.ts`
Expected: PASS — `20 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/map-compare.ts tests/lib/map-compare.test.ts
git commit -m "feat(student-map): add pure map comparison with fuzzy label matching"
```

---

## Task 3: Student map repository

**Files:**
- Create: `lib/repositories/student-map.ts`
- Test: `tests/repositories/student-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/student-map.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { ensureDemoUser } from '@/lib/repositories/assessment'
import {
  deleteStudentMap,
  findStudentMap,
  listStudentMaps,
  saveStudentMap,
} from '@/lib/repositories/student-map'

const input = {
  courseSlug: 'generative-ai',
  title: 'My first attempt',
  nodes: [
    { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
    { id: 'n2', label: 'Embeddings', x: 200, y: 0 },
  ],
  edges: [
    { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' as const },
  ],
}

afterEach(async () => {
  const user = await ensureDemoUser()
  await prisma.conceptMap.deleteMany({ where: { userId: user.id } })
})

describe('saveStudentMap', () => {
  it('creates a new map', async () => {
    const user = await ensureDemoUser()
    const map = await saveStudentMap(user.id, input)
    expect(map.title).toBe('My first attempt')
    expect(map.nodes).toHaveLength(2)
    expect(map.edges).toHaveLength(1)
  })

  it('preserves node labels and positions', async () => {
    const user = await ensureDemoUser()
    const map = await saveStudentMap(user.id, input)
    const embeddings = map.nodes.find((n) => n.label === 'Embeddings')
    expect(embeddings!.x).toBe(200)
  })

  it('preserves edge endpoints using the returned node ids', async () => {
    const user = await ensureDemoUser()
    const map = await saveStudentMap(user.id, input)
    const from = map.nodes.find((n) => n.id === map.edges[0].fromId)
    const to = map.nodes.find((n) => n.id === map.edges[0].toId)
    expect(from!.label).toBe('Tokenization')
    expect(to!.label).toBe('Embeddings')
  })

  it('updates an existing map when given its id', async () => {
    const user = await ensureDemoUser()
    const first = await saveStudentMap(user.id, input)
    const second = await saveStudentMap(user.id, {
      ...input,
      id: first.id,
      title: 'Revised',
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Revised')
    expect(second.nodes).toHaveLength(1)
    expect(second.edges).toHaveLength(0)
  })

  it('throws NOT_FOUND for an unknown course slug', async () => {
    const user = await ensureDemoUser()
    await expect(
      saveStudentMap(user.id, { ...input, courseSlug: 'nope' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('findStudentMap', () => {
  it('returns the saved map', async () => {
    const user = await ensureDemoUser()
    const saved = await saveStudentMap(user.id, input)
    const found = await findStudentMap(saved.id)
    expect(found!.title).toBe('My first attempt')
  })

  it('returns null for an unknown id', async () => {
    await expect(findStudentMap('nope')).resolves.toBeNull()
  })
})

describe('listStudentMaps', () => {
  it('returns the learner maps for a course', async () => {
    const user = await ensureDemoUser()
    await saveStudentMap(user.id, input)
    const maps = await listStudentMaps(user.id, 'generative-ai')
    expect(maps).toHaveLength(1)
  })

  it('does not return maps from another course', async () => {
    const user = await ensureDemoUser()
    await saveStudentMap(user.id, input)
    await expect(listStudentMaps(user.id, 'ai-agents')).resolves.toEqual([])
  })
})

describe('deleteStudentMap', () => {
  it('removes the map and its nodes', async () => {
    const user = await ensureDemoUser()
    const saved = await saveStudentMap(user.id, input)
    await deleteStudentMap(saved.id)
    expect(await findStudentMap(saved.id)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/student-map.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/student-map.ts`**

Client-side node ids are temporary. On save they are replaced by database ids, and edges are rewritten to point at the new ids.

```ts
import prisma from '@/lib/prisma'
import { ApiError } from '@/lib/api'
import type { SaveMapInput } from '@/lib/schemas/student-map'
import type { RelationshipType } from '@/lib/schemas/concept'

export type StoredMap = {
  id: string
  courseSlug: string
  title: string
  updatedAt: string
  nodes: { id: string; label: string; x: number; y: number }[]
  edges: { id: string; fromId: string; toId: string; type: RelationshipType }[]
}

async function load(id: string): Promise<StoredMap | null> {
  const row = await prisma.conceptMap.findUnique({
    where: { id },
    include: {
      course: { select: { slug: true } },
      nodes: true,
      edges: true,
    },
  })
  if (!row) return null

  return {
    id: row.id,
    courseSlug: row.course.slug,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    nodes: row.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      x: n.x,
      y: n.y,
    })),
    edges: row.edges.map((e) => ({
      id: e.id,
      fromId: e.fromId,
      toId: e.toId,
      type: e.type,
    })),
  }
}

export async function saveStudentMap(
  userId: string,
  input: SaveMapInput,
): Promise<StoredMap> {
  const course = await prisma.course.findUnique({
    where: { slug: input.courseSlug },
    select: { id: true },
  })
  if (!course) {
    throw new ApiError(
      'NOT_FOUND',
      `No course with slug "${input.courseSlug}"`,
      404,
    )
  }

  const mapId = await prisma.$transaction(async (tx) => {
    let id = input.id

    if (id) {
      const existing = await tx.conceptMap.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!existing) {
        throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
      }
      await tx.conceptMap.update({
        where: { id },
        data: { title: input.title },
      })
      await tx.conceptMapEdge.deleteMany({ where: { mapId: id } })
      await tx.conceptMapNode.deleteMany({ where: { mapId: id } })
    } else {
      const created = await tx.conceptMap.create({
        data: { userId, courseId: course.id, title: input.title },
      })
      id = created.id
    }

    // Client ids are not stable; map them to the ids the database assigns.
    const dbIdByClientId = new Map<string, string>()
    for (const node of input.nodes) {
      const created = await tx.conceptMapNode.create({
        data: { mapId: id, label: node.label, x: node.x, y: node.y },
      })
      dbIdByClientId.set(node.id, created.id)
    }

    for (const edge of input.edges) {
      const fromId = dbIdByClientId.get(edge.fromId)
      const toId = dbIdByClientId.get(edge.toId)
      if (!fromId || !toId) continue
      await tx.conceptMapEdge.create({
        data: { mapId: id, fromId, toId, type: edge.type },
      })
    }

    return id
  })

  const saved = await load(mapId)
  if (!saved) throw new Error('Map vanished immediately after save')
  return saved
}

export async function findStudentMap(id: string): Promise<StoredMap | null> {
  return load(id)
}

export async function listStudentMaps(
  userId: string,
  courseSlug: string,
): Promise<StoredMap[]> {
  const rows = await prisma.conceptMap.findMany({
    where: { userId, course: { slug: courseSlug } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  const maps: StoredMap[] = []
  for (const row of rows) {
    const map = await load(row.id)
    if (map) maps.push(map)
  }
  return maps
}

export async function deleteStudentMap(id: string): Promise<void> {
  await prisma.conceptMap.delete({ where: { id } })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/student-map.test.ts`
Expected: PASS — `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/student-map.ts tests/repositories/student-map.test.ts
git commit -m "feat(student-map): add student map repository with id remapping"
```

---

## Task 4: Narrative feedback

The model receives the computed diff, never the raw maps. It writes prose; it does not decide what is right.

**Files:**
- Modify: `lib/ai/prompts.ts`
- Create: `lib/ai/map-feedback.ts`
- Test: `tests/ai/map-feedback.test.ts`

- [ ] **Step 1: Append the prompt to `lib/ai/prompts.ts`**

```ts
export type MapFeedbackRequest = {
  courseTitle: string
  score: number
  matchedConcepts: string[]
  missingConcepts: string[]
  unrecognisedNodes: string[]
  correctEdges: { from: string; to: string }[]
  missingEdges: { from: string; to: string }[]
  incorrectEdges: { from: string; to: string }[]
}

function list(items: string[]): string {
  return items.length > 0 ? items.join(', ') : '(none)'
}

function edgeList(edges: { from: string; to: string }[]): string {
  return edges.length > 0
    ? edges.map((e) => `${e.from} -> ${e.to}`).join(', ')
    : '(none)'
}

export function mapFeedbackPrompt(request: MapFeedbackRequest): string {
  return `A learner drew a concept map for "${request.courseTitle}".
The structural comparison has already been computed. Your job is to turn it
into feedback the learner can act on. Do not re-judge the comparison.

Score: ${request.score}/100
Concepts they included: ${list(request.matchedConcepts)}
Concepts they omitted: ${list(request.missingConcepts)}
Nodes that match no course concept: ${list(request.unrecognisedNodes)}
Connections they got right: ${edgeList(request.correctEdges)}
Connections they omitted: ${edgeList(request.missingEdges)}
Connections that are not in the course map: ${edgeList(request.incorrectEdges)}

Rules:
- Be specific. Name concepts. Do not write generic encouragement.
- An omitted connection usually signals a real gap in understanding — say what the gap is.
- A connection that is not in the course map may still be defensible. Say so if it is.
- Pick exactly one next step. Not a list.

Return JSON:
{
  "summary": "2-3 sentences on what their map shows about their understanding",
  "strengths": ["specific things they got right, up to 3"],
  "gaps": ["specific things to fix, up to 3"],
  "nextStep": "one concrete action"
}`
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/ai/map-feedback.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/gemini', () => ({ generateStructured }))

const comparison = {
  matchedConcepts: ['Tokenization', 'Embeddings'],
  missingConcepts: ['Attention'],
  unrecognisedNodes: [],
  correctEdges: [{ from: 'Tokenization', to: 'Embeddings' }],
  missingEdges: [{ from: 'Embeddings', to: 'Attention' }],
  incorrectEdges: [],
  mistypedEdges: [],
  score: 65,
}

const feedback = {
  summary: 'You have the input pipeline but not the mechanism.',
  strengths: ['Correctly placed tokenization before embeddings.'],
  gaps: ['Attention is missing entirely.'],
  nextStep: 'Read the attention concept, then add it after embeddings.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateMapFeedback', () => {
  it('returns the validated feedback', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.nextStep).toContain('attention')
  })

  it('includes the missing concepts in the prompt', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    await generateMapFeedback('Generative AI', comparison)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('Attention')
  })

  it('includes the score in the prompt', async () => {
    generateStructured.mockResolvedValue(feedback)
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    await generateMapFeedback('Generative AI', comparison)
    expect(generateStructured.mock.calls[0][0].prompt).toContain('65/100')
  })

  it('falls back to deterministic feedback when the model fails', async () => {
    generateStructured.mockRejectedValue(new Error('model down'))
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.summary).toContain('65')
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('names the missing concept in the fallback', async () => {
    generateStructured.mockRejectedValue(new Error('model down'))
    const { generateMapFeedback } = await import('@/lib/ai/map-feedback')
    const result = await generateMapFeedback('Generative AI', comparison)
    expect(result.gaps.join(' ')).toContain('Attention')
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test tests/ai/map-feedback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `lib/ai/map-feedback.ts`**

A comparison is useful even without prose, so a model failure degrades to deterministic feedback rather than an error.

```ts
import { generateStructured } from '@/lib/ai/gemini'
import { mapFeedbackPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'
import { mapFeedbackSchema, type MapFeedback } from '@/lib/schemas/student-map'
import type { MapComparison } from '@/lib/map-compare'

function fallback(comparison: MapComparison): MapFeedback {
  const gaps: string[] = []

  if (comparison.missingConcepts.length > 0) {
    gaps.push(
      `Missing concepts: ${comparison.missingConcepts.slice(0, 3).join(', ')}.`,
    )
  }
  if (comparison.missingEdges.length > 0) {
    const edges = comparison.missingEdges
      .slice(0, 3)
      .map((e) => `${e.from} to ${e.to}`)
      .join(', ')
    gaps.push(`Missing connections: ${edges}.`)
  }
  if (comparison.incorrectEdges.length > 0) {
    const edges = comparison.incorrectEdges
      .slice(0, 3)
      .map((e) => `${e.from} to ${e.to}`)
      .join(', ')
    gaps.push(`Connections not in the course map: ${edges}.`)
  }

  const strengths: string[] = []
  if (comparison.matchedConcepts.length > 0) {
    strengths.push(
      `You identified ${comparison.matchedConcepts.length} course concepts.`,
    )
  }
  if (comparison.correctEdges.length > 0) {
    strengths.push(
      `${comparison.correctEdges.length} of your connections match the course map.`,
    )
  }

  return {
    summary: `Your map scored ${comparison.score} out of 100 against the course map.`,
    strengths,
    gaps,
    nextStep:
      comparison.missingConcepts.length > 0
        ? `Read up on ${comparison.missingConcepts[0]}, then add it to your map.`
        : 'Review the connections you missed and redraw them.',
  }
}

export async function generateMapFeedback(
  courseTitle: string,
  comparison: MapComparison,
): Promise<MapFeedback> {
  try {
    return await generateStructured({
      prompt: mapFeedbackPrompt({
        courseTitle,
        score: comparison.score,
        matchedConcepts: comparison.matchedConcepts,
        missingConcepts: comparison.missingConcepts,
        unrecognisedNodes: comparison.unrecognisedNodes,
        correctEdges: comparison.correctEdges,
        missingEdges: comparison.missingEdges,
        incorrectEdges: comparison.incorrectEdges,
      }),
      schema: mapFeedbackSchema,
      system: TUTOR_SYSTEM,
      temperature: 0.4,
    })
  } catch (error) {
    console.error('Map feedback generation failed, using fallback:', error)
    return fallback(comparison)
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/ai/map-feedback.test.ts`
Expected: PASS — `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/map-feedback.ts lib/ai/prompts.ts tests/ai/map-feedback.test.ts
git commit -m "feat(student-map): add narrative feedback with deterministic fallback"
```

---

## Task 5: Map endpoints

**Files:**
- Create: `app/api/concept-maps/route.ts`
- Create: `app/api/concept-maps/[id]/route.ts`
- Create: `app/api/concept-maps/[id]/compare/route.ts`
- Test: `tests/api/concept-maps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/concept-maps.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureDemoUser = vi.fn()
const saveStudentMap = vi.fn()
const findStudentMap = vi.fn()
const listStudentMaps = vi.fn()
const deleteStudentMap = vi.fn()
const getCourseGraph = vi.fn()
const findCourseBySlug = vi.fn()
const generateMapFeedback = vi.fn()

vi.mock('@/lib/repositories/assessment', () => ({ ensureDemoUser }))
vi.mock('@/lib/repositories/student-map', () => ({
  saveStudentMap,
  findStudentMap,
  listStudentMaps,
  deleteStudentMap,
}))
vi.mock('@/lib/repositories/concept', () => ({ getCourseGraph }))
vi.mock('@/lib/repositories/course', () => ({ findCourseBySlug }))
vi.mock('@/lib/ai/map-feedback', () => ({ generateMapFeedback }))

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) })
}

const validBody = {
  courseSlug: 'generative-ai',
  title: 'My map',
  nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
  edges: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureDemoUser.mockResolvedValue({ id: 'u1' })
})

describe('POST /api/concept-maps', () => {
  it('saves a valid map', async () => {
    saveStudentMap.mockResolvedValue({ id: 'm1', title: 'My map' })
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(post('http://t/api/concept-maps', validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('m1')
  })

  it('rejects a map with no nodes', async () => {
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(
      post('http://t/api/concept-maps', { ...validBody, nodes: [] }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects an edge pointing at a node not in the map', async () => {
    const { POST } = await import('@/app/api/concept-maps/route')
    const res = await POST(
      post('http://t/api/concept-maps', {
        ...validBody,
        edges: [{ id: 'e1', fromId: 'n1', toId: 'ghost', type: 'RELATED_TO' }],
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('GET /api/concept-maps', () => {
  it('returns the learner maps for a course', async () => {
    listStudentMaps.mockResolvedValue([{ id: 'm1' }])
    const { GET } = await import('@/app/api/concept-maps/route')
    const res = await GET(
      new Request('http://t/api/concept-maps?courseSlug=generative-ai'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('rejects a request with no courseSlug', async () => {
    const { GET } = await import('@/app/api/concept-maps/route')
    const res = await GET(new Request('http://t/api/concept-maps'))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/concept-maps/[id]', () => {
  it('deletes an existing map', async () => {
    findStudentMap.mockResolvedValue({ id: 'm1' })
    const { DELETE } = await import('@/app/api/concept-maps/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    expect(deleteStudentMap).toHaveBeenCalledWith('m1')
  })

  it('returns 404 for an unknown map', async () => {
    findStudentMap.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/concept-maps/[id]/route')
    const res = await DELETE(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/concept-maps/[id]/compare', () => {
  it('returns the comparison and feedback', async () => {
    findStudentMap.mockResolvedValue({
      id: 'm1',
      courseSlug: 'generative-ai',
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    findCourseBySlug.mockResolvedValue({ title: 'Generative AI Foundations' })
    getCourseGraph.mockResolvedValue({
      concepts: [
        {
          id: 'c1',
          courseId: 'c',
          name: 'Tokenization',
          definition: 'd',
          difficulty: 'BEGINNER',
          objectives: [],
        },
      ],
      relationships: [],
    })
    generateMapFeedback.mockResolvedValue({
      summary: 's',
      strengths: [],
      gaps: [],
      nextStep: 'n',
    })

    const { POST } = await import('@/app/api/concept-maps/[id]/compare/route')
    const res = await POST(new Request('http://t', { method: 'POST' }), {
      params: Promise.resolve({ id: 'm1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.comparison.score).toBe(100)
    expect(body.data.feedback.nextStep).toBe('n')
  })

  it('returns 404 for an unknown map', async () => {
    findStudentMap.mockResolvedValue(null)
    const { POST } = await import('@/app/api/concept-maps/[id]/compare/route')
    const res = await POST(new Request('http://t', { method: 'POST' }), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/concept-maps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/concept-maps/route.ts`**

```ts
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { saveMapSchema } from '@/lib/schemas/student-map'
import {
  listStudentMaps,
  saveStudentMap,
} from '@/lib/repositories/student-map'
import { ensureDemoUser } from '@/lib/repositories/assessment'

export async function GET(request: Request) {
  return handle(async () => {
    const courseSlug = new URL(request.url).searchParams.get('courseSlug')
    if (!courseSlug) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'courseSlug query parameter is required',
        400,
      )
    }
    const user = await ensureDemoUser()
    const maps = await listStudentMaps(user.id, courseSlug)
    return ok(maps)
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, saveMapSchema)
    const user = await ensureDemoUser()
    const map = await saveStudentMap(user.id, input)
    return ok(map, 201)
  })
}
```

- [ ] **Step 4: Create `app/api/concept-maps/[id]/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import {
  deleteStudentMap,
  findStudentMap,
} from '@/lib/repositories/student-map'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
    return ok(map)
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
    await deleteStudentMap(id)
    return ok({ deleted: true })
  })
}
```

- [ ] **Step 5: Create `app/api/concept-maps/[id]/compare/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import { findStudentMap } from '@/lib/repositories/student-map'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'
import { compareMaps } from '@/lib/map-compare'
import { generateMapFeedback } from '@/lib/ai/map-feedback'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params

    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)

    const [graph, course] = await Promise.all([
      getCourseGraph(map.courseSlug),
      findCourseBySlug(map.courseSlug),
    ])
    if (!graph || !course) {
      throw new ApiError('NOT_FOUND', 'The course for this map is missing', 404)
    }

    const comparison = compareMaps(graph, {
      nodes: map.nodes,
      edges: map.edges,
    })

    const feedback = await generateMapFeedback(course.title, comparison)

    return ok({ comparison, feedback })
  })
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/api/concept-maps.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 7: Commit**

```bash
git add app/api/concept-maps tests/api/concept-maps.test.ts
git commit -m "feat(api): add student map save, list, delete and compare endpoints"
```

---

## Task 6: Comparison display

**Files:**
- Create: `components/map-comparison.tsx`
- Test: `tests/components/map-comparison.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/map-comparison.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapComparisonView } from '@/components/map-comparison'

const comparison = {
  matchedConcepts: ['Tokenization', 'Embeddings'],
  missingConcepts: ['Attention'],
  unrecognisedNodes: ['Blockchain'],
  correctEdges: [{ from: 'Tokenization', to: 'Embeddings' }],
  missingEdges: [{ from: 'Embeddings', to: 'Attention' }],
  incorrectEdges: [{ from: 'Tokenization', to: 'Attention' }],
  mistypedEdges: [],
  score: 65,
}

const feedback = {
  summary: 'You have the pipeline but not the mechanism.',
  strengths: ['Tokenization correctly precedes embeddings.'],
  gaps: ['Attention is missing.'],
  nextStep: 'Read attention, then add it after embeddings.',
}

describe('MapComparisonView', () => {
  it('renders the score', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('renders the feedback summary', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(
      screen.getByText('You have the pipeline but not the mechanism.'),
    ).toBeInTheDocument()
  })

  it('renders the next step', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(
      screen.getByText('Read attention, then add it after embeddings.'),
    ).toBeInTheDocument()
  })

  it('lists the missing concepts', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('lists the unrecognised nodes', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Blockchain')).toBeInTheDocument()
  })

  it('renders missing connections in arrow form', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Embeddings → Attention')).toBeInTheDocument()
  })

  it('renders connections not in the course map', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Tokenization → Attention')).toBeInTheDocument()
  })

  it('omits a section that has no entries', () => {
    render(
      <MapComparisonView
        comparison={{ ...comparison, unrecognisedNodes: [] }}
        feedback={feedback}
      />,
    )
    expect(screen.queryByText('Not in this course')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/map-comparison.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/map-comparison.tsx`**

```tsx
import { ArrowRight, Check, CircleHelp, Lightbulb, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { EdgeRef, MapComparison } from '@/lib/map-compare'
import type { MapFeedback } from '@/lib/schemas/student-map'

function BadgeSection({
  title,
  items,
  variant,
}: {
  title: string
  items: string[]
  variant: 'secondary' | 'destructive' | 'outline'
}) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant={variant}>
            {item}
          </Badge>
        ))}
      </div>
    </section>
  )
}

function EdgeSection({
  title,
  edges,
  variant,
}: {
  title: string
  edges: EdgeRef[]
  variant: 'secondary' | 'destructive' | 'outline'
}) {
  if (edges.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {edges.map((edge) => (
          <Badge key={`${edge.from}-${edge.to}`} variant={variant}>
            {edge.from} → {edge.to}
          </Badge>
        ))}
      </div>
    </section>
  )
}

export function MapComparisonView({
  comparison,
  feedback,
}: {
  comparison: MapComparison
  feedback: MapFeedback
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How your map compares</CardTitle>
          <CardDescription>{feedback.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {comparison.score}
            </span>
            <span className="text-sm text-muted-foreground">out of 100</span>
          </div>
          <Progress value={comparison.score} />
        </CardContent>
      </Card>

      {(feedback.strengths.length > 0 || feedback.gaps.length > 0) && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            {feedback.strengths.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Check data-icon className="size-3.5" />
                  What you got right
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {feedback.strengths.map((item) => (
                    <li key={item} className="text-sm leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {feedback.gaps.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <X data-icon className="size-3.5" />
                  What to fix
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {feedback.gaps.map((item) => (
                    <li key={item} className="text-sm leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Separator />

            <section className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3">
              <Lightbulb data-icon className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm leading-relaxed">{feedback.nextStep}</p>
            </section>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Structural detail</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <BadgeSection
            title="Concepts you included"
            items={comparison.matchedConcepts}
            variant="secondary"
          />
          <BadgeSection
            title="Concepts you missed"
            items={comparison.missingConcepts}
            variant="destructive"
          />
          <BadgeSection
            title="Not in this course"
            items={comparison.unrecognisedNodes}
            variant="outline"
          />
          <EdgeSection
            title="Connections you got right"
            edges={comparison.correctEdges}
            variant="secondary"
          />
          <EdgeSection
            title="Connections you missed"
            edges={comparison.missingEdges}
            variant="destructive"
          />
          <EdgeSection
            title="Connections not in the course map"
            edges={comparison.incorrectEdges}
            variant="outline"
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

Note: `ArrowRight` and `CircleHelp` are imported above but unused in the final markup — remove them from the import to keep the lint clean.

- [ ] **Step 4: Fix the unused imports**

Change the lucide import line to:

```tsx
import { Check, Lightbulb, X } from 'lucide-react'
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/map-comparison.test.tsx`
Expected: PASS — `8 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/map-comparison.tsx tests/components/map-comparison.test.tsx
git commit -m "feat(student-map): add comparison result display"
```

---

## Task 7: Map editor

**Files:**
- Create: `components/map-editor.tsx`
- Test: `tests/components/map-editor.test.tsx`

Only the pure state helpers are unit-tested. The canvas interactions are verified manually in Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/components/map-editor.test.tsx`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addNode,
  removeNode,
  renameNode,
  toSavePayload,
} from '@/components/map-editor'

const state = {
  nodes: [
    { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
    { id: 'n2', label: 'Embeddings', x: 100, y: 0 },
  ],
  edges: [
    { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' as const },
  ],
}

describe('addNode', () => {
  it('appends a node', () => {
    const next = addNode(state, 'Attention')
    expect(next.nodes).toHaveLength(3)
    expect(next.nodes[2].label).toBe('Attention')
  })

  it('gives the new node a unique id', () => {
    const next = addNode(state, 'Attention')
    const ids = next.nodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves existing edges untouched', () => {
    expect(addNode(state, 'Attention').edges).toEqual(state.edges)
  })
})

describe('renameNode', () => {
  it('changes the label of the target node', () => {
    const next = renameNode(state, 'n1', 'Tokenisation')
    expect(next.nodes[0].label).toBe('Tokenisation')
  })

  it('leaves other nodes untouched', () => {
    const next = renameNode(state, 'n1', 'X')
    expect(next.nodes[1].label).toBe('Embeddings')
  })

  it('ignores an unknown node id', () => {
    expect(renameNode(state, 'ghost', 'X').nodes).toEqual(state.nodes)
  })
})

describe('removeNode', () => {
  it('removes the node', () => {
    const next = removeNode(state, 'n1')
    expect(next.nodes.map((n) => n.id)).toEqual(['n2'])
  })

  it('removes edges touching the node', () => {
    expect(removeNode(state, 'n1').edges).toHaveLength(0)
  })

  it('keeps edges that do not touch the node', () => {
    const extended = {
      nodes: [...state.nodes, { id: 'n3', label: 'C', x: 0, y: 0 }],
      edges: [
        ...state.edges,
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'RELATED_TO' as const },
      ],
    }
    expect(removeNode(extended, 'n1').edges.map((e) => e.id)).toEqual(['e2'])
  })
})

describe('toSavePayload', () => {
  it('includes the course slug and title', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', undefined)
    expect(payload.courseSlug).toBe('generative-ai')
    expect(payload.title).toBe('My map')
  })

  it('includes the id when updating an existing map', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', 'm1')
    expect(payload.id).toBe('m1')
  })

  it('omits the id when creating a new map', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', undefined)
    expect(payload).not.toHaveProperty('id')
  })

  it('drops nodes with a blank label', () => {
    const withBlank = {
      nodes: [...state.nodes, { id: 'n3', label: '   ', x: 0, y: 0 }],
      edges: state.edges,
    }
    expect(toSavePayload(withBlank, 's', 't', undefined).nodes).toHaveLength(2)
  })

  it('drops edges whose endpoints were dropped', () => {
    const withBlank = {
      nodes: [...state.nodes, { id: 'n3', label: '  ', x: 0, y: 0 }],
      edges: [
        ...state.edges,
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'RELATED_TO' as const },
      ],
    }
    expect(toSavePayload(withBlank, 's', 't', undefined).edges).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/map-editor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/map-editor.tsx`**

```tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  addEdge,
  Background,
  Controls,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { StudentEdge, StudentNode } from '@/lib/schemas/student-map'

export type EditorState = {
  nodes: StudentNode[]
  edges: StudentEdge[]
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

export function addNode(state: EditorState, label: string): EditorState {
  const column = state.nodes.length % 4
  const row = Math.floor(state.nodes.length / 4)
  return {
    ...state,
    nodes: [
      ...state.nodes,
      {
        id: nextId('node'),
        label,
        x: column * 220,
        y: row * 140,
      },
    ],
  }
}

export function renameNode(
  state: EditorState,
  id: string,
  label: string,
): EditorState {
  return {
    ...state,
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
  }
}

export function removeNode(state: EditorState, id: string): EditorState {
  return {
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.fromId !== id && e.toId !== id),
  }
}

export function toSavePayload(
  state: EditorState,
  courseSlug: string,
  title: string,
  id: string | undefined,
) {
  const nodes = state.nodes.filter((n) => n.label.trim().length > 0)
  const keptIds = new Set(nodes.map((n) => n.id))
  const edges = state.edges.filter(
    (e) => keptIds.has(e.fromId) && keptIds.has(e.toId),
  )

  return {
    ...(id ? { id } : {}),
    courseSlug,
    title,
    nodes,
    edges,
  }
}

export function MapEditor({
  state,
  onChange,
  onSelect,
  selectedId,
}: {
  state: EditorState
  onChange: (next: EditorState) => void
  onSelect: (id: string | null) => void
  selectedId: string | null
}) {
  const [flowNodes, setFlowNodes] = useState<Node[]>([])

  const nodes = useMemo<Node[]>(
    () =>
      state.nodes.map((node) => ({
        id: node.id,
        position: { x: node.x, y: node.y },
        data: { label: node.label },
        selected: node.id === selectedId,
        style: {
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
        },
      })),
    [state.nodes, selectedId],
  )

  const edges = useMemo(
    () =>
      state.edges.map((edge) => ({
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        animated: edge.type === 'PREREQUISITE_OF',
        label: edge.type === 'PREREQUISITE_OF' ? 'requires' : undefined,
      })),
    [state.edges],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes)
      setFlowNodes(updated)
      onChange({
        ...state,
        nodes: state.nodes.map((node) => {
          const match = updated.find((u) => u.id === node.id)
          return match
            ? { ...node, x: match.position.x, y: match.position.y }
            : node
        }),
      })
    },
    [nodes, onChange, state],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return

      const exists = state.edges.some(
        (e) => e.fromId === connection.source && e.toId === connection.target,
      )
      if (exists) return

      onChange({
        ...state,
        edges: [
          ...state.edges,
          {
            id: nextId('edge'),
            fromId: connection.source,
            toId: connection.target,
            type: 'PREREQUISITE_OF',
          },
        ],
      })
    },
    [onChange, state],
  )

  return (
    <div className="h-[32rem] overflow-hidden rounded-xl border">
      <ReactFlow
        nodes={flowNodes.length > 0 ? nodes : nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodeClick={(_e, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onEdgesDelete={(deleted) =>
          onChange({
            ...state,
            edges: state.edges.filter(
              (e) => !deleted.some((d) => d.id === e.id),
            ),
          })
        }
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
```

Note: `addEdge` is imported but unused — remove it from the `@xyflow/react` import.

- [ ] **Step 4: Fix the unused import**

Change the `@xyflow/react` import to:

```tsx
import {
  Background,
  Controls,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Node,
  type NodeChange,
} from '@xyflow/react'
```

Also remove the now-redundant `flowNodes` state and its `useState` import usage — `nodes` is derived from `state` on every render, so the local copy serves no purpose. Replace the `ReactFlow` `nodes` prop with `nodes={nodes}` and delete the `setFlowNodes` call from `handleNodesChange`.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/map-editor.test.ts`
Expected: PASS — `14 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/map-editor.tsx tests/components/map-editor.test.ts
git commit -m "feat(student-map): add editable react flow canvas with pure state helpers"
```

---

## Task 8: Student map page

**Files:**
- Create: `components/map-workspace.tsx`
- Create: `app/courses/[slug]/my-map/page.tsx`
- Modify: `app/courses/[slug]/page.tsx`

- [ ] **Step 1: Create `components/map-workspace.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { GitCompare, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  MapEditor,
  addNode,
  removeNode,
  renameNode,
  toSavePayload,
  type EditorState,
} from '@/components/map-editor'
import { MapComparisonView } from '@/components/map-comparison'
import { apiFetch } from '@/lib/fetcher'
import type { MapComparison } from '@/lib/map-compare'
import type { MapFeedback } from '@/lib/schemas/student-map'

type CompareResult = {
  comparison: MapComparison
  feedback: MapFeedback
}

export function MapWorkspace({
  courseSlug,
  initial,
}: {
  courseSlug: string
  initial: { id: string; title: string } & EditorState | null
}) {
  const [mapId, setMapId] = useState(initial?.id)
  const [title, setTitle] = useState(initial?.title ?? 'My concept map')
  const [state, setState] = useState<EditorState>({
    nodes: initial?.nodes ?? [],
    edges: initial?.edges ?? [],
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = state.nodes.find((n) => n.id === selectedId) ?? null

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    setState((prev) => addNode(prev, label))
    setNewLabel('')
  }

  async function save() {
    if (state.nodes.length === 0) {
      setError('Add at least one concept before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await apiFetch<{ id: string } & EditorState>(
        '/api/concept-maps',
        {
          method: 'POST',
          json: toSavePayload(state, courseSlug, title, mapId),
        },
      )
      setMapId(saved.id)
      setState({ nodes: saved.nodes, edges: saved.edges })
      toast.success('Map saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your map')
    } finally {
      setSaving(false)
    }
  }

  async function compare() {
    if (!mapId) {
      setError('Save your map before comparing it.')
      return
    }

    setComparing(true)
    setError(null)
    try {
      const response = await apiFetch<CompareResult>(
        `/api/concept-maps/${mapId}/compare`,
        { method: 'POST' },
      )
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare your map')
    } finally {
      setComparing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name your map"
          className="max-w-sm font-medium"
        />

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add a concept..."
            className="max-w-xs"
          />
          <Button
            variant="secondary"
            onClick={handleAdd}
            disabled={newLabel.trim().length === 0}
          >
            <Plus data-icon />
            Add
          </Button>

          <div className="ml-auto flex gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner data-icon /> : <Save data-icon />}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => void compare()}
              disabled={comparing || !mapId}
            >
              {comparing ? <Spinner data-icon /> : <GitCompare data-icon />}
              Compare
            </Button>
          </div>
        </div>

        {selected && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected
              </span>
              <Input
                value={selected.label}
                onChange={(e) =>
                  setState((prev) => renameNode(prev, selected.id, e.target.value))
                }
                className="max-w-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete concept"
                onClick={() => {
                  setState((prev) => removeNode(prev, selected.id))
                  setSelectedId(null)
                }}
              >
                <Trash2 data-icon />
              </Button>
            </div>
          </>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <MapEditor
        state={state}
        onChange={setState}
        onSelect={setSelectedId}
        selectedId={selectedId}
      />

      {result && (
        <MapComparisonView
          comparison={result.comparison}
          feedback={result.feedback}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/courses/[slug]/my-map/page.tsx`**

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
import { MapWorkspace } from '@/components/map-workspace'
import { findCourseBySlug } from '@/lib/repositories/course'
import { listStudentMaps } from '@/lib/repositories/student-map'
import { ensureDemoUser } from '@/lib/repositories/assessment'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return {
    title: course ? `Your ${course.title} map — Adaptive` : 'Your map — Adaptive',
  }
}

export default async function MyMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  if (!course) notFound()

  const user = await ensureDemoUser()
  const maps = await listStudentMaps(user.id, slug)
  const latest = maps[0] ?? null

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
              {course.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Your map</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Draw your own map
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add the concepts you remember and connect them. Drag from a node&apos;s
          right edge to its neighbour&apos;s left edge to draw a prerequisite.
          Then compare against the course map to see what you missed.
        </p>
      </header>

      <MapWorkspace
        courseSlug={slug}
        initial={
          latest
            ? {
                id: latest.id,
                title: latest.title,
                nodes: latest.nodes,
                edges: latest.edges,
              }
            : null
        }
      />
    </div>
  )
}
```

- [ ] **Step 3: Link it from the course page**

In `app/courses/[slug]/page.tsx`, add the import:

```tsx
import { PenLine } from 'lucide-react'
```

Then, inside the button row you added in Phase 2, add a second button next to **View concept map**:

```tsx
          <Button variant="outline" render={<Link href={`/courses/${course.slug}/my-map`} />}>
            <PenLine data-icon />
            Draw your own map
          </Button>
```

Wrap both buttons in a `<div className="flex flex-wrap gap-2 pt-2">` if they are not already.

- [ ] **Step 4: Smoke-test the full loop**

Run: `npm run dev`, open `/courses/generative-ai/my-map`.

Add three concepts: `Tokenization`, `Embeddings`, `Attention`. Drag them apart. Connect Tokenization → Embeddings and Embeddings → Attention by dragging between node handles. Click **Save**.

Expected: a success toast, and the map persists on reload.

- [ ] **Step 5: Test the comparison**

Click **Compare**.
Expected: a score near 100 if you drew the canonical structure, with the matched concepts and correct connections listed, and narrative feedback above the structural detail.

Now delete the Attention node and save again, then compare.
Expected: the score drops, `Attention` appears under **Concepts you missed**, and `Embeddings → Attention` appears under **Connections you missed**.

- [ ] **Step 6: Test fuzzy matching**

Rename `Tokenization` to `Tokenisation` (British spelling) and compare.
Expected: it still matches — the concept is not reported as missing.

Now add a node called `Blockchain Consensus` and compare.
Expected: it appears under **Not in this course**, and the edges touching it are not counted against you.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 8: Commit**

```bash
git add components/map-workspace.tsx "app/courses/[slug]/my-map" "app/courses/[slug]/page.tsx"
git commit -m "feat(student-map): add map workspace page with save and compare"
```

---

## Phase 6 Exit Checklist

- [ ] A learner can add, rename, move, delete nodes and draw edges
- [ ] Saving persists the map; reloading restores it
- [ ] Client-side node ids are correctly remapped to database ids on save
- [ ] Re-saving an existing map updates it rather than creating a duplicate
- [ ] Comparison correctly identifies matched, missing, and unrecognised concepts
- [ ] Comparison correctly identifies correct, missing, and extraneous edges
- [ ] Fuzzy matching tolerates spelling variants but not unrelated labels
- [ ] Edges touching unrecognised nodes are ignored, not penalised
- [ ] Feedback degrades to deterministic text when the model is unavailable
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-07-adaptive-engine.md`](./phase-07-adaptive-engine.md).
