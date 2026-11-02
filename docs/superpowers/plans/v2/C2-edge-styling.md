# C2 — Edge Styling

**Depends on:** C1 (spacing). **Blocks:** nothing.

**Problem:** edge labels render as React Flow's default white pill with black text. On a dark background they are the brightest thing on screen — louder than the nodes they describe. All four relationship types look identical, so `requires` and `related` carry the same visual weight despite meaning very different things.

**Decision:** a custom edge component. Theme the label, colour and dash the stroke per relationship type, and dim edges unrelated to the current selection.

| Type | Meaning | Treatment |
|---|---|---|
| `PREREQUISITE_OF` | Hard dependency | Solid, primary, animated, arrowhead |
| `LEADS_TO` | Natural progression | Solid, muted, arrowhead |
| `RELATED_TO` | Lateral link | Dashed, muted, no arrowhead |
| `PART_OF` | Composition | Dotted, muted, no arrowhead |

---

## Task 1: Edge style map

**File:** create `lib/concept-edge-style.ts`, test `tests/lib/concept-edge-style.test.ts`

Pure data, so it is testable without rendering.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { EDGE_STYLES, edgeStyleFor } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'

const ALL: RelationshipType[] = [
  'PREREQUISITE_OF',
  'RELATED_TO',
  'PART_OF',
  'LEADS_TO',
]

describe('EDGE_STYLES', () => {
  it('covers every relationship type', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type]).toBeDefined()
    }
  })

  it('gives every type a label', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type].label.length).toBeGreaterThan(0)
    }
  })

  it('animates only prerequisites', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.animated).toBe(true)
    expect(EDGE_STYLES.RELATED_TO.animated).toBe(false)
    expect(EDGE_STYLES.PART_OF.animated).toBe(false)
    expect(EDGE_STYLES.LEADS_TO.animated).toBe(false)
  })

  it('marks direction only on directional types', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.directed).toBe(true)
    expect(EDGE_STYLES.LEADS_TO.directed).toBe(true)
    expect(EDGE_STYLES.RELATED_TO.directed).toBe(false)
  })

  it('uses css variables, never hex', () => {
    for (const type of ALL) {
      expect(EDGE_STYLES[type].stroke).toMatch(/^var\(--/)
    }
  })

  it('distinguishes types by dash pattern', () => {
    expect(EDGE_STYLES.PREREQUISITE_OF.dash).toBeUndefined()
    expect(EDGE_STYLES.RELATED_TO.dash).toBeDefined()
    expect(EDGE_STYLES.PART_OF.dash).toBeDefined()
    expect(EDGE_STYLES.RELATED_TO.dash).not.toBe(EDGE_STYLES.PART_OF.dash)
  })
})

describe('edgeStyleFor', () => {
  it('returns the matching style', () => {
    expect(edgeStyleFor('PREREQUISITE_OF').label).toBe('requires')
  })

  it('falls back to RELATED_TO for an unknown type', () => {
    expect(edgeStyleFor('NONSENSE' as RelationshipType).label).toBe('related')
  })
})
```

- [ ] **Step 2: Create `lib/concept-edge-style.ts`**

```ts
import type { RelationshipType } from '@/lib/schemas/concept'

export type EdgeStyle = {
  label: string
  /** CSS variable reference so the stroke follows the theme. */
  stroke: string
  strokeWidth: number
  /** SVG stroke-dasharray. Undefined means solid. */
  dash?: string
  animated: boolean
  /** Whether to render an arrowhead. */
  directed: boolean
  /** Tailwind classes for the label chip. */
  labelClass: string
}

export const EDGE_STYLES: Record<RelationshipType, EdgeStyle> = {
  PREREQUISITE_OF: {
    label: 'requires',
    stroke: 'var(--color-primary)',
    strokeWidth: 2,
    animated: true,
    directed: true,
    labelClass: 'border-primary/40 bg-primary/10 text-primary',
  },
  LEADS_TO: {
    label: 'leads to',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    animated: false,
    directed: true,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
  RELATED_TO: {
    label: 'related',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    dash: '6 4',
    animated: false,
    directed: false,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
  PART_OF: {
    label: 'part of',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    dash: '2 3',
    animated: false,
    directed: false,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
}

export function edgeStyleFor(type: RelationshipType): EdgeStyle {
  return EDGE_STYLES[type] ?? EDGE_STYLES.RELATED_TO
}
```

- [ ] **Step 3: Tests pass (8), commit**

```bash
git add lib/concept-edge-style.ts tests/lib/concept-edge-style.test.ts
git commit -m "feat(map): add per-relationship edge style map"
```

---

## Task 2: Custom edge component

**File:** create `components/concept-edge.tsx`

- [ ] **Step 1: Build it**

```tsx
'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { cn } from '@/lib/utils'
import { edgeStyleFor } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'

export type ConceptEdgeData = {
  type: RelationshipType
  /** Set when a node is selected and this edge does not touch it. */
  dimmed?: boolean
  /** Set when this edge touches the selected node. */
  highlighted?: boolean
}

export function ConceptEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = (data ?? {}) as ConceptEdgeData
  const style = edgeStyleFor(edgeData.type)

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    // Gentler than the default; long spans stay readable.
    curvature: 0.3,
  })

  const opacity = edgeData.dimmed ? 0.15 : edgeData.highlighted ? 1 : 0.55

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={style.directed ? markerEnd : undefined}
        style={{
          stroke: style.stroke,
          strokeWidth: edgeData.highlighted
            ? style.strokeWidth + 0.75
            : style.strokeWidth,
          strokeDasharray: style.dash,
          opacity,
          transition: 'opacity 200ms, stroke-width 200ms',
        }}
        className={cn(style.animated && !edgeData.dimmed && 'animate-dash')}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity,
          }}
          className={cn(
            'pointer-events-none absolute rounded-full border px-2 py-0.5',
            'text-[10px] font-medium tracking-wide uppercase',
            'transition-opacity duration-200',
            style.labelClass,
          )}
        >
          {style.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
```

`EdgeLabelRenderer` portals the label into an overlay layer, so it is real DOM that accepts Tailwind classes — unlike React Flow's built-in `label` prop, which renders an unstyleable SVG `<text>` with a white `<rect>` behind it.

- [ ] **Step 2: Add the dash animation**

React Flow's `animated` prop applies its own keyframes. Define ours in `app/globals.css` so it respects the theme and reduced-motion preference:

```css
@keyframes dash {
  to {
    stroke-dashoffset: -16;
  }
}

.animate-dash {
  stroke-dasharray: 8 8;
  animation: dash 1.2s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-dash {
    animation: none;
  }
}
```

---

## Task 3: Wire it in

**File:** modify `components/concept-map-canvas.tsx`

- [ ] **Step 1: Register the edge type**

```tsx
import { MarkerType } from '@xyflow/react'
import { ConceptEdge } from '@/components/concept-edge'

const nodeTypes = { concept: ConceptNode }
const edgeTypes = { concept: ConceptEdge }
```

- [ ] **Step 2: Decorate edges with selection state**

```tsx
const styledEdges = useMemo(() => {
  const touchesSelection = (e: { source: string; target: string }) =>
    selectedId !== null && (e.source === selectedId || e.target === selectedId)

  return edges.map((edge) => ({
    ...edge,
    type: 'concept' as const,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    data: {
      type: edge.data.type,
      highlighted: touchesSelection(edge),
      dimmed: selectedId !== null && !touchesSelection(edge),
    },
  }))
}, [edges, selectedId])
```

- [ ] **Step 3: Pass them through**

```tsx
<ReactFlow
  nodes={styledNodes}
  edges={styledEdges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  ...
```

Drop `animated` and `label` from `layoutGraph`'s edge output — the component owns both now. Keep `data.type`; that is what drives everything.

- [ ] **Step 4: Update the layout test**

`tests/lib/concept-layout.test.ts` asserts `edges[0].animated === true`. Replace with:

```ts
it('tags every edge with its relationship type', () => {
  const { edges } = layoutGraph(graph)
  expect(edges[0].data.type).toBe('PREREQUISITE_OF')
})
```

---

## Task 4: Legend

Four line styles mean nothing without a key.

**File:** create `components/concept-map-legend.tsx`

```tsx
import { EDGE_STYLES } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'
import { cn } from '@/lib/utils'

const ORDER: RelationshipType[] = [
  'PREREQUISITE_OF',
  'LEADS_TO',
  'RELATED_TO',
  'PART_OF',
]

export function ConceptMapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {ORDER.map((type) => {
        const style = EDGE_STYLES[type]
        return (
          <span
            key={type}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <svg width="20" height="2" aria-hidden="true">
              <line
                x1="0"
                y1="1"
                x2="20"
                y2="1"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.dash}
              />
            </svg>
            {style.label}
          </span>
        )
      })}
    </div>
  )
}
```

Render it under the header on `app/courses/[slug]/map/page.tsx`, and in the learn page's map section header.

---

## Task 5: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Visual check**

```bash
npm run dev
```

On `/courses/ai-agents/map` — the screenshot that showed the problem:

- [ ] Labels are small, lowercase, theme-coloured chips, not white pills
- [ ] `requires` edges are primary-coloured and animated
- [ ] `related` edges are dashed and muted
- [ ] Clicking a node dims every unrelated edge
- [ ] The legend reads clearly
- [ ] Toggle to light mode — still legible

- [ ] **Step 3: Reduced motion**

In devtools, emulate `prefers-reduced-motion: reduce`. The dash animation should stop; everything else stays.

- [ ] **Step 4: Commit**

```bash
git add components/concept-edge.tsx components/concept-map-legend.tsx components/concept-map-canvas.tsx lib/concept-layout.ts app/globals.css tests/lib/concept-layout.test.ts "app/courses/[slug]/map/page.tsx"
git commit -m "feat(map): replace default edge labels with themed custom edges

React Flow's built-in label renders an unstyleable white SVG rect, which
on a dark canvas was the brightest element on screen. Adds a custom edge
with a portalled Tailwind label, per-type stroke and dash, selection
dimming, and a legend."
```

---

## Exit checklist

- [ ] No white label pills anywhere on the map
- [ ] Each relationship type is visually distinct
- [ ] Only prerequisites animate
- [ ] Selecting a node dims unrelated edges
- [ ] Arrowheads appear only on directional types
- [ ] Legend present on both the standalone and embedded map
- [ ] Reduced motion is respected
- [ ] Readable in both themes
- [ ] All verification commands pass

Next: [`C3-panel-navigation.md`](./C3-panel-navigation.md).
