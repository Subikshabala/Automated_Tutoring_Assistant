# C3 — Panel Navigation

**Depends on:** C1, C2. **Blocks:** nothing.

**Problem:** the detail panel lists prerequisites and unlocks as `<Badge>` elements. They are not clickable. A learner reading about *Tool Calling* sees *ReAct Pattern* listed as a prerequisite and has no way to jump to it — they must hunt for the node on the canvas.

On the learn page the equivalent buttons *do* call `setActiveId`, but the viewport does not move, so clicking a prerequisite silently swaps content 800px above the fold.

**Decision:** make every concept reference navigable, and move the viewport to match. Two parts: clickable refs in the detail panel, and scroll-into-view on the learn page.

---

## Task 1: Clickable references

**File:** modify `components/concept-detail-panel.tsx`, test `tests/components/concept-detail-panel.test.tsx`

- [ ] **Step 1: Add failing cases**

```tsx
describe('ConceptDetailPanel navigation', () => {
  const refs = [{ id: 'p1', name: 'Text Basics' }]

  it('renders prerequisites as buttons when a handler is given', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Text Basics' }),
    ).toBeInTheDocument()
  })

  it('calls the handler with the concept id', async () => {
    const onSelect = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={onSelect}
      />,
    )
    await u.click(screen.getByRole('button', { name: 'Text Basics' }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('renders static badges when no handler is given', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
      />,
    )
    expect(screen.getByText('Text Basics')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Text Basics' }),
    ).not.toBeInTheDocument()
  })

  it('makes unlocks clickable too', async () => {
    const onSelect = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[]}
        unlocks={[{ id: 'u1', name: 'Embeddings' }]}
        onSelectConcept={onSelect}
      />,
    )
    await u.click(screen.getByRole('button', { name: 'Embeddings' }))
    expect(onSelect).toHaveBeenCalledWith('u1')
  })

  it('labels each button for screen readers', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Text Basics' }),
    ).toHaveAttribute('aria-label', 'Go to Text Basics')
  })
})
```

Add `userEvent` and `vi` to the imports.

- [ ] **Step 2: Extend the component**

```tsx
export function ConceptDetailPanel({
  concept,
  prerequisites,
  unlocks,
  onSelectConcept,
}: {
  concept: ConceptDto | null
  prerequisites: ConceptRef[]
  unlocks: ConceptRef[]
  /** When provided, references become navigable buttons. */
  onSelectConcept?: (conceptId: string) => void
})
```

Replace `RefList`:

```tsx
function RefList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: ConceptRef[]
  onSelect?: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) =>
          onSelect ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-label={`Go to ${item.name}`}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                'border-border bg-card text-foreground',
                'transition-colors duration-200',
                'hover:border-primary/50 hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {item.name}
            </button>
          ) : (
            <Badge key={item.id} variant="outline">
              {item.name}
            </Badge>
          ),
        )}
      </div>
    </section>
  )
}
```

Import `cn`. Pass `onSelect={onSelectConcept}` to both `RefList` calls.

- [ ] **Step 3: Pass the handler from the canvas**

In `components/concept-map-canvas.tsx`:

```tsx
<ConceptDetailPanel
  concept={selectedConcept}
  prerequisites={prerequisites}
  unlocks={unlocks}
  onSelectConcept={handleSelect}
/>
```

`handleSelect` already exists from the C1 controlled-state work.

- [ ] **Step 4: Tests pass, commit**

```bash
npx vitest run tests/components/concept-detail-panel.test.tsx --fileParallelism=false
git add components/concept-detail-panel.tsx components/concept-map-canvas.tsx tests/components/concept-detail-panel.test.tsx
git commit -m "feat(map): make prerequisite and unlock references navigable"
```

---

## Task 2: Centre the canvas on selection

**File:** modify `components/concept-map-canvas.tsx`

Clicking a reference for an offscreen node currently does nothing visible.

- [ ] **Step 1: Pan to the selected node**

React Flow's imperative API needs `useReactFlow`, which must run inside a `ReactFlowProvider`. Extract an inner component:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from '@xyflow/react'
```

Inside the inner component:

```tsx
function CanvasInner({ ... }) {
  const { setCenter, getNode } = useReactFlow()

  // Pan to a node that was selected from outside the canvas — a detail
  // panel reference or a learn-page chip. Without this the selection
  // changes offscreen and looks like nothing happened.
  useEffect(() => {
    if (!selectedId) return
    const node = getNode(selectedId)
    if (!node) return

    setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1, duration: 400 },
    )
  }, [selectedId, getNode, setCenter])
```

Import `NODE_WIDTH` and `NODE_HEIGHT` from `lib/concept-layout`.

- [ ] **Step 2: Wrap the export**

```tsx
export function ConceptMapCanvas(props: ConceptMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
```

Keep `getNeighbours` exported from module scope — `tests/components/concept-map-canvas.test.ts` imports it directly and must keep passing.

- [ ] **Step 3: Respect reduced motion**

```tsx
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

setCenter(x, y, { zoom: 1, duration: prefersReducedMotion ? 0 : 400 })
```

---

## Task 3: Scroll the learn page

**File:** modify `components/learn-view.tsx`

Selecting a concept swaps the detail section far below the fold.

- [ ] **Step 1: Add a ref and a scroll effect**

```tsx
const detailRef = useRef<HTMLElement | null>(null)
const isFirstRender = useRef(true)

useEffect(() => {
  // Do not scroll on mount — the learner has not asked for anything yet.
  if (isFirstRender.current) {
    isFirstRender.current = false
    return
  }
  if (!activeId) return

  detailRef.current?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start',
  })
}, [activeId])
```

Import `useRef`.

- [ ] **Step 2: Attach it to the detail section**

```tsx
<section
  ref={detailRef}
  className="flex scroll-mt-20 flex-col gap-5 pt-2"
>
```

`scroll-mt-20` offsets the sticky header so the heading is not hidden under it.

- [ ] **Step 3: Pass the handler to the embedded panel**

The learn page's own prerequisite and unlock buttons already call `setActiveId`. With the scroll effect they now move the viewport too. No further change.

---

## Task 4: Keyboard navigation

The canvas is mouse-only.

**File:** modify `components/concept-node.tsx`

- [ ] **Step 1: Make nodes focusable**

```tsx
<div
  data-selected={selected}
  data-difficulty={concept.difficulty}
  tabIndex={0}
  role="button"
  aria-label={`${concept.name}. ${concept.difficulty.toLowerCase()}. Press Enter for details.`}
  aria-pressed={selected}
  className={cn(
    'w-56 cursor-pointer rounded-lg border border-l-4 bg-card px-3 py-2.5 shadow-sm',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    DIFFICULTY_ACCENT[concept.difficulty],
    selected
      ? 'border-primary bg-accent/30 shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.03]'
      : 'hover:border-primary/40 hover:shadow-md',
  )}
>
```

React Flow handles the click. Enter and Space come free from `role="button"` plus `tabIndex`.

- [ ] **Step 2: Test it**

```tsx
it('is reachable by keyboard', () => {
  const { container } = render(<ConceptNode data={{ concept }} selected={false} />)
  expect(container.firstChild).toHaveAttribute('tabIndex', '0')
})

it('announces its state', () => {
  const { container } = render(<ConceptNode data={{ concept }} selected={true} />)
  expect(container.firstChild).toHaveAttribute('aria-pressed', 'true')
})

it('describes itself for screen readers', () => {
  const { container } = render(<ConceptNode data={{ concept }} selected={false} />)
  expect(container.firstChild).toHaveAttribute(
    'aria-label',
    expect.stringContaining('Tokenization'),
  )
})
```

---

## Task 5: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Standalone map**

Open `/courses/generative-ai/map`.

- [ ] Click **Attention** → panel fills
- [ ] Click **Embeddings** under Prerequisites → selection changes **and the canvas pans to it**
- [ ] Click **Semantic Search** under Unlocks → pans again
- [ ] Tab to a node, press Enter → selects
- [ ] Focus ring is visible

- [ ] **Step 3: Learn page**

Open a topic with 3+ concepts.

- [ ] Click a concept chip → page scrolls to the detail section
- [ ] Click a prerequisite button → content swaps **and** the page scrolls
- [ ] The embedded map pans to the same concept
- [ ] On first load the page does **not** auto-scroll

- [ ] **Step 4: Reduced motion**

Emulate `prefers-reduced-motion: reduce`. Navigation still works, transitions are instant.

- [ ] **Step 5: Commit**

```bash
git add components/concept-map-canvas.tsx components/learn-view.tsx components/concept-node.tsx tests/components/concept-node.test.tsx
git commit -m "feat(map): pan and scroll to concepts selected from outside the canvas

Selecting a prerequisite from the detail panel or a chip on the learn page
changed state offscreen. The canvas now pans to the node and the learn page
scrolls to the detail section. Nodes are keyboard-focusable."
```

---

## Exit checklist

- [ ] Prerequisite and unlock refs are buttons that navigate
- [ ] The canvas pans to a node selected from outside
- [ ] The learn page scrolls to the detail section on change
- [ ] No auto-scroll on first render
- [ ] Nodes are keyboard-reachable with a visible focus ring
- [ ] Reduced motion respected throughout
- [ ] All verification commands pass

Part C complete. Next: [`D1-fix-add-node.md`](./D1-fix-add-node.md).
