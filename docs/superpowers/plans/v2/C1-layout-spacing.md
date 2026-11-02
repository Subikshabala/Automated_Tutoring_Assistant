# C1 — Concept Map Layout

**Depends on:** A1. **Blocks:** C2, C3.

**Problem:** the map is cramped and edges cross unnecessarily.

| Measured | Value |
|---|---|
| `COLUMN_WIDTH` | 280px |
| Node width (`w-56`) | 224px |
| Horizontal gutter | **56px** |
| `ROW_HEIGHT` | 130px |
| Node height (title + 2-line clamp) | ~88px |
| Vertical gutter | **42px** |

56px is not enough room for an edge plus its label. Labels overlap neighbouring nodes, which is why the screenshot looks tangled.

Worse: nodes inside a depth column are ordered by the arbitrary order `getCourseGraph` returned them, so an edge from the top of column 1 may run to the bottom of column 2 while another runs the opposite way. Those crossings are avoidable.

**Decision:** widen the gutters, size rows from actual node height, and order each column by the mean position of its neighbours (barycentre heuristic) to reduce crossings.

---

## Task 1: Spacing constants

**File:** modify `lib/concept-layout.ts`, test `tests/lib/concept-layout.test.ts`

- [ ] **Step 1: Add failing assertions**

Append to the `layoutGraph` describe block:

```ts
it('leaves room for an edge label between columns', () => {
  const { nodes } = layoutGraph(graph)
  const a = nodes.find((n) => n.id === 'a')!
  const b = nodes.find((n) => n.id === 'b')!
  // Node is 224px wide; a label needs ~120px of clear space.
  expect(b.position.x - a.position.x).toBeGreaterThanOrEqual(360)
})

it('leaves room between stacked siblings', () => {
  const { nodes } = layoutGraph(graph)
  const b = nodes.find((n) => n.id === 'b')!
  const c = nodes.find((n) => n.id === 'c')!
  expect(Math.abs(b.position.y - c.position.y)).toBeGreaterThanOrEqual(150)
})

it('exposes the layout constants it used', () => {
  const { bounds } = layoutGraph(graph)
  expect(bounds.columnWidth).toBe(380)
  expect(bounds.rowHeight).toBe(160)
})
```

- [ ] **Step 2: Update the constants**

```ts
/**
 * Node is w-56 (224px). 380 leaves ~156px of clear horizontal space,
 * enough for an edge plus a centred label without overlapping a node.
 */
const COLUMN_WIDTH = 380

/**
 * Node renders ~88px tall (title + 2-line clamped definition).
 * 160 gives ~72px of vertical breathing room.
 */
const ROW_HEIGHT = 160

export const NODE_WIDTH = 224
export const NODE_HEIGHT = 88
```

- [ ] **Step 3: Return bounds**

Callers need the extents to fit the view sensibly.

```ts
export type LayoutBounds = {
  columnWidth: number
  rowHeight: number
  columns: number
  maxRows: number
  width: number
  height: number
}

export function layoutGraph(graph: ConceptGraph): {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  bounds: LayoutBounds
} {
```

Build it before the return:

```ts
  const columns = byDepth.size
  const maxRows = Math.max(1, ...[...byDepth.values()].map((b) => b.length))

  const bounds: LayoutBounds = {
    columnWidth: COLUMN_WIDTH,
    rowHeight: ROW_HEIGHT,
    columns,
    maxRows,
    width: columns * COLUMN_WIDTH + NODE_WIDTH,
    height: maxRows * ROW_HEIGHT + NODE_HEIGHT,
  }

  return { nodes, edges, bounds }
```

- [ ] **Step 4: Fix the existing call sites**

`layoutGraph` now returns a third key. `components/concept-map-canvas.tsx` destructures `{ nodes, edges }` — that still compiles. No change needed, but TypeScript will flag any test asserting on the exact return shape.

- [ ] **Step 5: Tests pass, commit**

```bash
npx vitest run tests/lib/concept-layout.test.ts --fileParallelism=false
git add lib/concept-layout.ts tests/lib/concept-layout.test.ts
git commit -m "fix(map): widen layout gutters to fit edge labels"
```

---

## Task 2: Barycentre ordering

**File:** modify `lib/concept-layout.ts`, test `tests/lib/concept-layout.test.ts`

The classic Sugiyama crossing-reduction step. For each column left to right, sort nodes by the mean row index of their predecessors. Two sweeps is enough at this graph size.

- [ ] **Step 1: Write the failing test**

```ts
describe('crossing reduction', () => {
  // a -> z, b -> y. Declared so the naive order crosses the edges.
  const crossing: ConceptGraph = {
    concepts: [
      concept('a', 'A'),
      concept('b', 'B'),
      concept('y', 'Y'),
      concept('z', 'Z'),
    ],
    relationships: [prereq('a', 'z'), prereq('b', 'y')],
  }

  it('orders the second column to follow its predecessors', () => {
    const { nodes } = layoutGraph(crossing)
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    const y = nodes.find((n) => n.id === 'y')!
    const z = nodes.find((n) => n.id === 'z')!

    // Whatever vertical order the roots land in, each target should sit
    // on the same side as its own source.
    const aAboveB = a.position.y < b.position.y
    const zAboveY = z.position.y < y.position.y
    expect(aAboveB).toBe(zAboveY)
  })

  it('keeps a node with no predecessors in a stable position', () => {
    const orphaned: ConceptGraph = {
      concepts: [concept('a', 'A'), concept('solo', 'Solo')],
      relationships: [],
    }
    const { nodes } = layoutGraph(orphaned)
    expect(nodes).toHaveLength(2)
    expect(nodes.every((n) => Number.isFinite(n.position.y))).toBe(true)
  })

  it('is deterministic across runs', () => {
    const first = layoutGraph(crossing).nodes.map((n) => `${n.id}:${n.position.y}`)
    const second = layoutGraph(crossing).nodes.map((n) => `${n.id}:${n.position.y}`)
    expect(first).toEqual(second)
  })

  it('does not drop or duplicate nodes', () => {
    const { nodes } = layoutGraph(crossing)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(4)
  })
})
```

- [ ] **Step 2: Implement**

Insert between bucketing by depth and emitting positions:

```ts
const BARYCENTRE_SWEEPS = 2

/**
 * Sugiyama crossing reduction. Sorts each column by the mean row index of
 * its predecessors, so an edge tends to run straight across rather than
 * diagonally past its neighbours.
 *
 * Mutates the arrays in `byDepth` in place.
 */
function reduceCrossings(
  byDepth: Map<number, ConceptDto[]>,
  relationships: ConceptRelationshipDto[],
): void {
  const predecessors = new Map<string, string[]>()
  for (const rel of relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    const bucket = predecessors.get(rel.toId)
    if (bucket) {
      bucket.push(rel.fromId)
    } else {
      predecessors.set(rel.toId, [rel.fromId])
    }
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b)

  for (let sweep = 0; sweep < BARYCENTRE_SWEEPS; sweep++) {
    // Row index of every node as currently ordered.
    const rowOf = new Map<string, number>()
    for (const depth of depths) {
      byDepth.get(depth)!.forEach((c, i) => rowOf.set(c.id, i))
    }

    // Left to right, skipping roots — they have nothing to follow.
    for (const depth of depths.slice(1)) {
      const column = byDepth.get(depth)!

      const barycentre = new Map<string, number>()
      column.forEach((concept, index) => {
        const preds = predecessors.get(concept.id) ?? []
        const rows = preds
          .map((id) => rowOf.get(id))
          .filter((r): r is number => r !== undefined)

        // No predecessors: keep current position so sorting stays stable.
        barycentre.set(
          concept.id,
          rows.length === 0
            ? index
            : rows.reduce((s, r) => s + r, 0) / rows.length,
        )
      })

      column.sort((a, b) => {
        const diff = barycentre.get(a.id)! - barycentre.get(b.id)!
        // Tie-break on name so the layout is deterministic.
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
    }
  }
}
```

Call it after bucketing:

```ts
  reduceCrossings(byDepth, graph.relationships)
```

- [ ] **Step 3: Tests pass, commit**

```bash
npx vitest run tests/lib/concept-layout.test.ts --fileParallelism=false
git add lib/concept-layout.ts tests/lib/concept-layout.test.ts
git commit -m "feat(map): reduce edge crossings with barycentre ordering"
```

---

## Task 3: Fit the view to the graph

**File:** modify `components/concept-map-canvas.tsx`

A 28-concept graph and a 3-concept graph currently get identical fit settings.

- [ ] **Step 1: Use the bounds**

```tsx
const { nodes, edges, bounds } = useMemo(() => layoutGraph(graph), [graph])
```

- [ ] **Step 2: Scale padding and zoom floor**

```tsx
// A wide graph needs to zoom out further; a small one should not
// balloon to fill the canvas.
const fitPadding = bounds.columns > 4 ? 0.1 : 0.25
const minZoom = bounds.columns > 6 ? 0.1 : 0.2
```

```tsx
  fitView
  fitViewOptions={{ padding: fitPadding, maxZoom: 1 }}
  minZoom={minZoom}
  maxZoom={1.5}
```

`maxZoom: 1` on `fitViewOptions` stops a two-node graph rendering at 3× scale.

- [ ] **Step 3: Give the embedded map more height**

The learn page embeds at `h-[300px] sm:h-[380px]`, which is tight for a 4-concept topic. Scale with row count:

```tsx
const embeddedHeight =
  bounds.maxRows >= 4 ? 'h-[460px]' : bounds.maxRows >= 3 ? 'h-[400px]' : 'h-[320px]'
```

```tsx
className={cn(
  'flex overflow-hidden rounded-xl border bg-background',
  hideDetailPanel ? embeddedHeight : 'h-[calc(100vh-10rem)]',
  className,
)}
```

Remove the hardcoded `className="h-[400px]"` the learn page passes, so this logic actually applies.

---

## Task 4: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Compare all three maps**

```bash
npm run dev
```

| Route | Concepts | Check |
|---|---|---|
| `/courses/generative-ai/map` | 11 | Widest graph. No node overlaps a label. Prerequisite chains read left to right. |
| `/courses/cybersecurity-essentials/map` | 9 | Two roots. Columns should not interleave. |
| `/courses/ai-agents/map` | 8 | The screenshot case. Fewer crossings than before. |

Count visible edge crossings on `ai-agents` before and after. It should drop.

- [ ] **Step 3: Check the embedded map**

Open a learn page. The map should be taller and the nodes less cramped than the standalone view at the same zoom.

- [ ] **Step 4: Commit**

```bash
git add components/concept-map-canvas.tsx components/learn-view.tsx
git commit -m "feat(map): scale fit, zoom and height to graph size"
```

---

## Exit checklist

- [ ] Horizontal gutter ≥ 150px — labels no longer overlap nodes
- [ ] Vertical gutter ≥ 70px
- [ ] Barycentre ordering reduces crossings on `ai-agents`
- [ ] Layout is deterministic across reloads
- [ ] No node is dropped or duplicated
- [ ] A small graph does not zoom past 1×
- [ ] The embedded map scales with row count
- [ ] All verification commands pass

Next: [`C2-edge-styling.md`](./C2-edge-styling.md) — the white label pills.
