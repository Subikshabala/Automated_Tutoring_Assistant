# Phase 2 — Concept Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner can open a course's concept map and see every concept as a node, prerequisite and related edges between them, laid out automatically, with a side panel showing details for the selected concept.

**Architecture:** A concept repository reads concepts plus relationships for a course. A pure layout function assigns x/y coordinates by topological depth — kept pure so it is unit-testable without a browser. React Flow renders it in a client component. The page is a Server Component that fetches once and hands the graph down.

**Tech Stack:** Prisma · Zod · `@xyflow/react` · React Server Components · shadcn/ui

**Depends on:** Phase 1 complete (seeded concepts and relationships exist).

**Done when:** `/courses/<slug>/map` renders all concepts of that course as a readable graph, prerequisite edges are visually distinct from related edges, and clicking a node opens a detail panel.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/repositories/concept.ts` | Concept + relationship queries |
| `lib/concept-layout.ts` | Pure graph → coordinates function |
| `app/api/courses/[slug]/concepts/route.ts` | `GET` course concept graph |
| `components/concept-node.tsx` | Custom React Flow node |
| `components/concept-detail-panel.tsx` | Side panel for a selected concept |
| `components/concept-map-canvas.tsx` | React Flow wrapper (client) |
| `app/courses/[slug]/map/page.tsx` | Concept map page |
| `app/courses/[slug]/map/loading.tsx` | Loading skeleton |

---

## Task 1: Concept repository

**Files:**
- Create: `lib/repositories/concept.ts`
- Test: `tests/repositories/concept.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/concept.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findConceptById, getCourseGraph } from '@/lib/repositories/concept'

describe('getCourseGraph', () => {
  it('returns every concept in the course', async () => {
    const graph = await getCourseGraph('generative-ai')
    expect(graph).not.toBeNull()
    expect(graph!.concepts).toHaveLength(11)
  })

  it('returns every relationship in the course', async () => {
    const graph = await getCourseGraph('generative-ai')
    expect(graph!.relationships).toHaveLength(11)
  })

  it('parses objectives into a real array', async () => {
    const graph = await getCourseGraph('generative-ai')
    const tokenization = graph!.concepts.find((c) => c.name === 'Tokenization')
    expect(tokenization!.objectives).toHaveLength(3)
    expect(tokenization!.objectives[0]).toContain('subwords')
  })

  it('only returns relationships whose endpoints are both in this course', async () => {
    const graph = await getCourseGraph('generative-ai')
    const ids = new Set(graph!.concepts.map((c) => c.id))
    for (const rel of graph!.relationships) {
      expect(ids.has(rel.fromId)).toBe(true)
      expect(ids.has(rel.toId)).toBe(true)
    }
  })

  it('returns null for an unknown course slug', async () => {
    await expect(getCourseGraph('nope')).resolves.toBeNull()
  })
})

describe('findConceptById', () => {
  it('returns a concept with its course and topic titles', async () => {
    const graph = await getCourseGraph('generative-ai')
    const target = graph!.concepts.find((c) => c.name === 'Attention')!
    const detail = await findConceptById(target.id)
    expect(detail!.name).toBe('Attention')
    expect(detail!.courseTitle).toBe('Generative AI Foundations')
    expect(detail!.topicTitle).toBe('Generation Mechanics')
  })

  it('returns null for an unknown id', async () => {
    await expect(findConceptById('nope')).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/concept.test.ts`
Expected: FAIL — `Cannot find module '@/lib/repositories/concept'`.

- [ ] **Step 3: Create `lib/repositories/concept.ts`**

```ts
import prisma from '@/lib/prisma'
import { readStringArray } from '@/lib/json-array'
import type { ConceptDto, ConceptGraph } from '@/lib/schemas/concept'

export type ConceptDetail = ConceptDto & {
  courseTitle: string
  courseSlug: string
  topicTitle: string | null
  moduleTitle: string | null
}

export async function getCourseGraph(
  courseSlug: string,
): Promise<ConceptGraph | null> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true },
  })
  if (!course) return null

  const concepts = await prisma.concept.findMany({
    where: { courseId: course.id },
    orderBy: [{ moduleId: 'asc' }, { topicId: 'asc' }, { order: 'asc' }],
  })

  const conceptIds = concepts.map((c) => c.id)

  const relationships = await prisma.conceptRelationship.findMany({
    where: {
      fromId: { in: conceptIds },
      toId: { in: conceptIds },
    },
  })

  return {
    concepts: concepts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      moduleId: c.moduleId,
      topicId: c.topicId,
      name: c.name,
      definition: c.definition,
      difficulty: c.difficulty,
      objectives: readStringArray(c.objectives),
    })),
    relationships: relationships.map((r) => ({
      id: r.id,
      fromId: r.fromId,
      toId: r.toId,
      type: r.type,
      strength: r.strength,
    })),
  }
}

export async function findConceptById(
  id: string,
): Promise<ConceptDetail | null> {
  const row = await prisma.concept.findUnique({
    where: { id },
    include: {
      course: { select: { title: true, slug: true } },
      topic: { select: { title: true } },
      module: { select: { title: true } },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    courseId: row.courseId,
    moduleId: row.moduleId,
    topicId: row.topicId,
    name: row.name,
    definition: row.definition,
    difficulty: row.difficulty,
    objectives: readStringArray(row.objectives),
    courseTitle: row.course.title,
    courseSlug: row.course.slug,
    topicTitle: row.topic?.title ?? null,
    moduleTitle: row.module?.title ?? null,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/concept.test.ts`
Expected: PASS — `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/concept.ts tests/repositories/concept.test.ts
git commit -m "feat(concepts): add concept repository with course graph query"
```

---

## Task 2: Layout algorithm

This is the one genuinely tricky piece of the phase. Keeping it pure means it is fully testable without rendering anything.

**Files:**
- Create: `lib/concept-layout.ts`
- Test: `tests/lib/concept-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/concept-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDepths, layoutGraph } from '@/lib/concept-layout'
import type { ConceptGraph } from '@/lib/schemas/concept'

function concept(id: string, name = id) {
  return {
    id,
    courseId: 'c1',
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

describe('computeDepths', () => {
  it('puts a node with no prerequisites at depth 0', () => {
    const depths = computeDepths([concept('a')], [])
    expect(depths.get('a')).toBe(0)
  })

  it('places a dependent one level deeper than its prerequisite', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [prereq('a', 'b')],
    )
    expect(depths.get('a')).toBe(0)
    expect(depths.get('b')).toBe(1)
  })

  it('uses the longest path when a node has several prerequisites', () => {
    // a -> b -> c, and a -> c directly. c must sit at depth 2, not 1.
    const depths = computeDepths(
      [concept('a'), concept('b'), concept('c')],
      [prereq('a', 'b'), prereq('b', 'c'), prereq('a', 'c')],
    )
    expect(depths.get('c')).toBe(2)
  })

  it('ignores non-prerequisite relationships when assigning depth', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [
        {
          id: 'r',
          fromId: 'a',
          toId: 'b',
          type: 'RELATED_TO' as const,
          strength: 1,
        },
      ],
    )
    expect(depths.get('b')).toBe(0)
  })

  it('does not hang on a cycle', () => {
    const depths = computeDepths(
      [concept('a'), concept('b')],
      [prereq('a', 'b'), prereq('b', 'a')],
    )
    expect(depths.size).toBe(2)
    for (const depth of depths.values()) {
      expect(Number.isFinite(depth)).toBe(true)
    }
  })
})

describe('layoutGraph', () => {
  const graph: ConceptGraph = {
    concepts: [concept('a'), concept('b'), concept('c')],
    relationships: [prereq('a', 'b'), prereq('a', 'c')],
  }

  it('returns one node per concept', () => {
    const { nodes } = layoutGraph(graph)
    expect(nodes).toHaveLength(3)
  })

  it('returns one edge per relationship', () => {
    const { edges } = layoutGraph(graph)
    expect(edges).toHaveLength(2)
  })

  it('gives every node a finite position', () => {
    const { nodes } = layoutGraph(graph)
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
  })

  it('places deeper nodes further right', () => {
    const { nodes } = layoutGraph(graph)
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    expect(b.position.x).toBeGreaterThan(a.position.x)
  })

  it('separates siblings vertically', () => {
    const { nodes } = layoutGraph(graph)
    const b = nodes.find((n) => n.id === 'b')!
    const c = nodes.find((n) => n.id === 'c')!
    expect(b.position.y).not.toBe(c.position.y)
  })

  it('marks prerequisite edges as animated', () => {
    const { edges } = layoutGraph(graph)
    expect(edges[0].animated).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/concept-layout.test.ts`
Expected: FAIL — `Cannot find module '@/lib/concept-layout'`.

- [ ] **Step 3: Create `lib/concept-layout.ts`**

```ts
import type {
  ConceptDto,
  ConceptGraph,
  ConceptRelationshipDto,
  RelationshipType,
} from '@/lib/schemas/concept'

export type LaidOutNode = {
  id: string
  type: 'concept'
  position: { x: number; y: number }
  data: { concept: ConceptDto }
}

export type LaidOutEdge = {
  id: string
  source: string
  target: string
  animated: boolean
  label?: string
  data: { type: RelationshipType }
}

const COLUMN_WIDTH = 280
const ROW_HEIGHT = 130
const MAX_ITERATIONS = 50

/**
 * Longest-path depth for each concept, following PREREQUISITE_OF edges only.
 * Relaxation is capped so a cyclic graph terminates instead of hanging.
 */
export function computeDepths(
  concepts: ConceptDto[],
  relationships: ConceptRelationshipDto[],
): Map<string, number> {
  const depths = new Map<string, number>()
  for (const concept of concepts) {
    depths.set(concept.id, 0)
  }

  const prerequisites = relationships.filter(
    (r) => r.type === 'PREREQUISITE_OF',
  )

  const limit = Math.min(concepts.length, MAX_ITERATIONS)

  for (let i = 0; i < limit; i++) {
    let changed = false
    for (const rel of prerequisites) {
      const from = depths.get(rel.fromId)
      const to = depths.get(rel.toId)
      if (from === undefined || to === undefined) continue
      if (to < from + 1) {
        depths.set(rel.toId, from + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  return depths
}

const EDGE_LABEL: Record<RelationshipType, string> = {
  PREREQUISITE_OF: 'requires',
  RELATED_TO: 'related',
  PART_OF: 'part of',
  LEADS_TO: 'leads to',
}

export function layoutGraph(graph: ConceptGraph): {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
} {
  const depths = computeDepths(graph.concepts, graph.relationships)

  const byDepth = new Map<number, ConceptDto[]>()
  for (const concept of graph.concepts) {
    const depth = depths.get(concept.id) ?? 0
    const bucket = byDepth.get(depth)
    if (bucket) {
      bucket.push(concept)
    } else {
      byDepth.set(depth, [concept])
    }
  }

  const nodes: LaidOutNode[] = []
  for (const [depth, bucket] of byDepth) {
    const offset = ((bucket.length - 1) * ROW_HEIGHT) / 2
    bucket.forEach((concept, index) => {
      nodes.push({
        id: concept.id,
        type: 'concept',
        position: {
          x: depth * COLUMN_WIDTH,
          y: index * ROW_HEIGHT - offset,
        },
        data: { concept },
      })
    })
  }

  const edges: LaidOutEdge[] = graph.relationships.map((rel) => ({
    id: rel.id,
    source: rel.fromId,
    target: rel.toId,
    animated: rel.type === 'PREREQUISITE_OF',
    label: EDGE_LABEL[rel.type],
    data: { type: rel.type },
  }))

  return { nodes, edges }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/concept-layout.test.ts`
Expected: PASS — `11 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/concept-layout.ts tests/lib/concept-layout.test.ts
git commit -m "feat(map): add pure layered graph layout with cycle guard"
```

---

## Task 3: Concept graph API

**Files:**
- Create: `app/api/courses/[slug]/concepts/route.ts`
- Test: `tests/api/concepts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/concepts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/[slug]/concepts/route'

function get(slug: string) {
  return GET(new Request(`http://localhost/api/courses/${slug}/concepts`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /api/courses/[slug]/concepts', () => {
  it('returns the concept graph for a known course', async () => {
    const res = await get('generative-ai')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.concepts).toHaveLength(11)
    expect(body.data.relationships).toHaveLength(11)
  })

  it('returns objectives as arrays, not json strings', async () => {
    const res = await get('generative-ai')
    const body = await res.json()
    expect(Array.isArray(body.data.concepts[0].objectives)).toBe(true)
  })

  it('returns 404 for an unknown course', async () => {
    const res = await get('nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/concepts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/courses/[slug]/concepts/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import { getCourseGraph } from '@/lib/repositories/concept'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(async () => {
    const { slug } = await params
    const graph = await getCourseGraph(slug)
    if (!graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${slug}"`, 404)
    }
    return ok(graph)
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/api/concepts.test.ts`
Expected: PASS — `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/courses/[slug]/concepts/route.ts" tests/api/concepts.test.ts
git commit -m "feat(api): add concept graph endpoint"
```

---

## Task 4: Custom concept node

**Files:**
- Create: `components/concept-node.tsx`
- Test: `tests/components/concept-node.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/concept-node.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConceptNode } from '@/components/concept-node'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))

const concept = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens so a model can process it.',
  difficulty: 'BEGINNER' as const,
  objectives: ['Explain subwords'],
}

describe('ConceptNode', () => {
  it('renders the concept name', () => {
    render(<ConceptNode data={{ concept }} selected={false} />)
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders a truncated definition', () => {
    render(<ConceptNode data={{ concept }} selected={false} />)
    expect(
      screen.getByText(/Splitting text into tokens/),
    ).toBeInTheDocument()
  })

  it('marks the node as selected for styling', () => {
    const { container } = render(
      <ConceptNode data={{ concept }} selected={true} />,
    )
    expect(container.firstChild).toHaveAttribute('data-selected', 'true')
  })

  it('exposes the difficulty as a data attribute', () => {
    const { container } = render(
      <ConceptNode data={{ concept }} selected={false} />,
    )
    expect(container.firstChild).toHaveAttribute('data-difficulty', 'BEGINNER')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/concept-node.test.tsx`
Expected: FAIL — `Cannot find module '@/components/concept-node'`.

- [ ] **Step 3: Create `components/concept-node.tsx`**

```tsx
'use client'

import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { ConceptDto } from '@/lib/schemas/concept'

const DIFFICULTY_ACCENT: Record<ConceptDto['difficulty'], string> = {
  BEGINNER: 'border-l-emerald-500',
  INTERMEDIATE: 'border-l-amber-500',
  ADVANCED: 'border-l-rose-500',
}

export function ConceptNode({
  data,
  selected,
}: {
  data: { concept: ConceptDto }
  selected: boolean
}) {
  const { concept } = data

  return (
    <div
      data-selected={selected}
      data-difficulty={concept.difficulty}
      className={cn(
        'w-56 rounded-lg border border-l-4 bg-card px-3 py-2.5 shadow-sm transition-all',
        DIFFICULTY_ACCENT[concept.difficulty],
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'hover:border-primary/40',
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2" />
      <p className="text-sm font-medium leading-tight">{concept.name}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {concept.definition}
      </p>
      <Handle type="source" position={Position.Right} className="!size-2" />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/concept-node.test.tsx`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/concept-node.tsx tests/components/concept-node.test.tsx
git commit -m "feat(map): add custom concept node with difficulty accent"
```

---

## Task 5: Detail panel

**Files:**
- Create: `components/concept-detail-panel.tsx`
- Test: `tests/components/concept-detail-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/concept-detail-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConceptDetailPanel } from '@/components/concept-detail-panel'
import type { ConceptDto } from '@/lib/schemas/concept'

const concept: ConceptDto = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens.',
  difficulty: 'BEGINNER',
  objectives: ['Explain subwords', 'Estimate token counts'],
}

describe('ConceptDetailPanel', () => {
  it('prompts the user when nothing is selected', () => {
    render(<ConceptDetailPanel concept={null} prerequisites={[]} unlocks={[]} />)
    expect(screen.getByText('Select a concept')).toBeInTheDocument()
  })

  it('renders the name and definition of the selected concept', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
    expect(screen.getByText('Splitting text into tokens.')).toBeInTheDocument()
  })

  it('lists every learning objective', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.getByText('Explain subwords')).toBeInTheDocument()
    expect(screen.getByText('Estimate token counts')).toBeInTheDocument()
  })

  it('lists prerequisites when there are any', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[{ id: 'p1', name: 'Text Basics' }]}
        unlocks={[]}
      />,
    )
    expect(screen.getByText('Prerequisites')).toBeInTheDocument()
    expect(screen.getByText('Text Basics')).toBeInTheDocument()
  })

  it('lists what the concept unlocks', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[]}
        unlocks={[{ id: 'u1', name: 'Embeddings' }]}
      />,
    )
    expect(screen.getByText('Unlocks')).toBeInTheDocument()
    expect(screen.getByText('Embeddings')).toBeInTheDocument()
  })

  it('hides the prerequisites section when there are none', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.queryByText('Prerequisites')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/concept-detail-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/concept-detail-panel.tsx`**

```tsx
'use client'

import { MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { ConceptDto } from '@/lib/schemas/concept'

export type ConceptRef = { id: string; name: string }

function RefList({ title, items }: { title: string; items: ConceptRef[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item.id} variant="outline">
            {item.name}
          </Badge>
        ))}
      </div>
    </section>
  )
}

export function ConceptDetailPanel({
  concept,
  prerequisites,
  unlocks,
}: {
  concept: ConceptDto | null
  prerequisites: ConceptRef[]
  unlocks: ConceptRef[]
}) {
  if (!concept) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MousePointerClick data-icon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Select a concept</p>
        <p className="text-xs text-muted-foreground">
          Click any node to see its definition and connections.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-5">
        <header className="flex flex-col gap-2">
          <DifficultyBadge difficulty={concept.difficulty} />
          <h2 className="text-lg font-semibold leading-tight">{concept.name}</h2>
          <p className="text-sm text-muted-foreground">{concept.definition}</p>
        </header>

        {concept.objectives.length > 0 && (
          <>
            <Separator />
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                You should be able to
              </h3>
              <ul className="flex flex-col gap-1.5">
                {concept.objectives.map((objective) => (
                  <li
                    key={objective}
                    className="flex gap-2 text-sm leading-snug"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {(prerequisites.length > 0 || unlocks.length > 0) && <Separator />}
        <RefList title="Prerequisites" items={prerequisites} />
        <RefList title="Unlocks" items={unlocks} />
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/concept-detail-panel.test.tsx`
Expected: PASS — `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/concept-detail-panel.tsx tests/components/concept-detail-panel.test.tsx
git commit -m "feat(map): add concept detail side panel"
```

---

## Task 6: Map canvas

**Files:**
- Create: `components/concept-map-canvas.tsx`
- Test: `tests/components/concept-map-canvas.test.tsx`

Only the neighbour-derivation logic is unit-tested; React Flow itself needs a real browser and is verified manually in Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/components/concept-map-canvas.test.tsx`:

```ts
import { describe, expect, it } from 'vitest'
import { getNeighbours } from '@/components/concept-map-canvas'
import type { ConceptGraph } from '@/lib/schemas/concept'

const graph: ConceptGraph = {
  concepts: [
    { id: 'a', courseId: 'c', name: 'A', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
    { id: 'b', courseId: 'c', name: 'B', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
    { id: 'c', courseId: 'c', name: 'C', definition: 'd', difficulty: 'BEGINNER', objectives: [] },
  ],
  relationships: [
    { id: 'r1', fromId: 'a', toId: 'b', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r2', fromId: 'b', toId: 'c', type: 'PREREQUISITE_OF', strength: 1 },
    { id: 'r3', fromId: 'a', toId: 'c', type: 'RELATED_TO', strength: 1 },
  ],
}

describe('getNeighbours', () => {
  it('returns empty lists when nothing is selected', () => {
    expect(getNeighbours(graph, null)).toEqual({ prerequisites: [], unlocks: [] })
  })

  it('finds the prerequisites of a concept', () => {
    const { prerequisites } = getNeighbours(graph, 'b')
    expect(prerequisites).toEqual([{ id: 'a', name: 'A' }])
  })

  it('finds what a concept unlocks', () => {
    const { unlocks } = getNeighbours(graph, 'b')
    expect(unlocks).toEqual([{ id: 'c', name: 'C' }])
  })

  it('ignores non-prerequisite edges', () => {
    const { prerequisites } = getNeighbours(graph, 'c')
    expect(prerequisites).toEqual([{ id: 'b', name: 'B' }])
  })

  it('returns empty lists for a root concept', () => {
    expect(getNeighbours(graph, 'a').prerequisites).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/concept-map-canvas.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/concept-map-canvas.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ConceptNode } from '@/components/concept-node'
import { ConceptDetailPanel, type ConceptRef } from '@/components/concept-detail-panel'
import { layoutGraph } from '@/lib/concept-layout'
import type { ConceptGraph } from '@/lib/schemas/concept'

export function getNeighbours(
  graph: ConceptGraph,
  selectedId: string | null,
): { prerequisites: ConceptRef[]; unlocks: ConceptRef[] } {
  if (!selectedId) return { prerequisites: [], unlocks: [] }

  const nameById = new Map(graph.concepts.map((c) => [c.id, c.name]))
  const prerequisites: ConceptRef[] = []
  const unlocks: ConceptRef[] = []

  for (const rel of graph.relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    if (rel.toId === selectedId) {
      const name = nameById.get(rel.fromId)
      if (name) prerequisites.push({ id: rel.fromId, name })
    }
    if (rel.fromId === selectedId) {
      const name = nameById.get(rel.toId)
      if (name) unlocks.push({ id: rel.toId, name })
    }
  }

  return { prerequisites, unlocks }
}

const nodeTypes = { concept: ConceptNode }

export function ConceptMapCanvas({ graph }: { graph: ConceptGraph }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => layoutGraph(graph), [graph])

  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  )

  const selectedConcept = useMemo(
    () => graph.concepts.find((c) => c.id === selectedId) ?? null,
    [graph.concepts, selectedId],
  )

  const { prerequisites, unlocks } = useMemo(
    () => getNeighbours(graph, selectedId),
    [graph, selectedId],
  )

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-xl border">
      <div className="flex-1">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node: Node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-muted" />
        </ReactFlow>
      </div>

      <aside className="w-80 shrink-0 border-l bg-card">
        <ConceptDetailPanel
          concept={selectedConcept}
          prerequisites={prerequisites}
          unlocks={unlocks}
        />
      </aside>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/concept-map-canvas.test.tsx`
Expected: PASS — `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/concept-map-canvas.tsx tests/components/concept-map-canvas.test.tsx
git commit -m "feat(map): add react flow canvas with selection-driven detail panel"
```

---

## Task 7: Concept map page

**Files:**
- Create: `app/courses/[slug]/map/page.tsx`
- Create: `app/courses/[slug]/map/loading.tsx`
- Modify: `app/courses/[slug]/page.tsx`

- [ ] **Step 1: Create `app/courses/[slug]/map/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[calc(100vh-10rem)] w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/courses/[slug]/map/page.tsx`**

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
import { ConceptMapCanvas } from '@/components/concept-map-canvas'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return {
    title: course ? `${course.title} map — Adaptive` : 'Concept map — Adaptive',
  }
}

export default async function ConceptMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [course, graph] = await Promise.all([
    findCourseBySlug(slug),
    getCourseGraph(slug),
  ])

  if (!course || !graph) notFound()

  return (
    <div className="flex flex-col gap-5">
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
            <BreadcrumbPage>Concept map</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {course.title} concept map
        </h1>
        <p className="text-sm text-muted-foreground">
          {graph.concepts.length} concepts. Animated edges are prerequisites —
          follow them left to right.
        </p>
      </header>

      <ConceptMapCanvas graph={graph} />
    </div>
  )
}
```

- [ ] **Step 3: Add a link from the course page**

In `app/courses/[slug]/page.tsx`, add this import at the top:

```tsx
import { Button } from '@/components/ui/button'
import { Network as NetworkIcon } from 'lucide-react'
```

Then, inside the `<header>` element, immediately after the closing `</div>` of the stats row, insert:

```tsx
        <div className="pt-2">
          <Button render={<Link href={`/courses/${course.slug}/map`} />}>
            <NetworkIcon data-icon />
            View concept map
          </Button>
        </div>
```

Note: the existing file already imports `Network` from lucide for the stats row, so the map button imports it under the alias `NetworkIcon` to avoid a duplicate identifier.

- [ ] **Step 4: Look at it**

Run: `npm run dev`, open `/courses/generative-ai`, click **View concept map**.
Expected: a left-to-right layered graph of 11 nodes. Root concepts (Tokenization, the prompting basics) sit in the leftmost column. Prerequisite edges animate. Clicking **Attention** fills the right panel with its definition, objectives, prerequisites (Embeddings) and unlocks (Temperature and Sampling). Clicking empty canvas clears the panel. Minimap and zoom controls work.

- [ ] **Step 5: Check the other two courses render**

Visit `/courses/cybersecurity-essentials/map` and `/courses/ai-agents/map`.
Expected: both render without overlapping nodes and without console errors.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 7: Commit**

```bash
git add "app/courses/[slug]/map" "app/courses/[slug]/page.tsx"
git commit -m "feat(map): add concept map page and link it from course detail"
```

---

## Phase 2 Exit Checklist

- [ ] `GET /api/courses/generative-ai/concepts` returns 11 concepts and 11 relationships
- [ ] `computeDepths` terminates on a cyclic graph (covered by test)
- [ ] All three course maps render without overlapping nodes
- [ ] Prerequisite edges are animated; other relationship types are not
- [ ] Clicking a node fills the detail panel; clicking the pane clears it
- [ ] Prerequisites and unlocks are correct for a mid-graph concept
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-03-ai-tutor.md`](./phase-03-ai-tutor.md).
