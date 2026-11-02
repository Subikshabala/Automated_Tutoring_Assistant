# D1 — Fix Add Node

**Depends on:** A1. **Blocks:** D2.

**Problem:** typing a concept name and clicking **Add** appears to do nothing. The canvas stays empty.

**Cause:** two bugs compounding.

1. `addNode` positions the first node at `x: 0, y: 0`. React Flow's `fitView` only runs on mount, when the node list was empty — so the viewport sits wherever it defaulted and the new node is offscreen.

2. `MapEditor` has a dead `flowNodes` state. The render reads `nodes={flowNodes.length > 0 ? nodes : nodes}` — both branches are identical, so `flowNodes` does nothing except trigger an extra render. The v1 plan flagged this for removal and the S7 port kept it.

**Decision:** place new nodes in the current viewport centre, pan to them, delete the dead state, and give the empty canvas an instruction instead of a blank grid.

---

## Task 1: Delete the dead state

**File:** modify `components/map-editor.tsx`

- [ ] **Step 1: Remove `flowNodes`**

Delete:

```tsx
const [flowNodes, setFlowNodes] = useState<Node[]>([])
```

In `handleNodesChange`, delete the `setFlowNodes(updated)` line.

In the JSX, change:

```tsx
nodes={flowNodes.length > 0 ? nodes : nodes}
```

to:

```tsx
nodes={nodes}
```

- [ ] **Step 2: Drop the now-unused import**

`useState` may still be needed elsewhere in the file — check before removing it.

- [ ] **Step 3: Confirm nothing broke**

```bash
npx vitest run tests/components/map-editor.test.ts --fileParallelism=false
npm run typecheck
```

The 14 existing tests cover the pure helpers only, so they should pass untouched.

- [ ] **Step 4: Commit**

```bash
git add components/map-editor.tsx
git commit -m "refactor(student-map): remove dead flowNodes state"
```

---

## Task 2: Position new nodes in view

**File:** modify `components/map-editor.tsx`, test `tests/components/map-editor.test.ts`

`addNode` is a pure function and must stay testable, so it takes an optional anchor rather than reaching for the viewport itself.

- [ ] **Step 1: Add failing cases**

```ts
describe('addNode positioning', () => {
  const empty = { nodes: [], edges: [] }

  it('places the first node at the origin by default', () => {
    const next = addNode(empty, 'First')
    expect(next.nodes[0].x).toBe(0)
    expect(next.nodes[0].y).toBe(0)
  })

  it('places a node at a given anchor', () => {
    const next = addNode(empty, 'First', { x: 400, y: 250 })
    expect(next.nodes[0].x).toBe(400)
    expect(next.nodes[0].y).toBe(250)
  })

  it('offsets successive nodes so they do not stack', () => {
    let s = addNode(empty, 'One', { x: 100, y: 100 })
    s = addNode(s, 'Two', { x: 100, y: 100 })
    expect(s.nodes[1].x).not.toBe(s.nodes[0].x)
  })

  it('wraps to a new row after four in a row', () => {
    let s = empty
    for (let i = 0; i < 5; i++) s = addNode(s, `N${i}`, { x: 0, y: 0 })
    expect(s.nodes[4].y).toBeGreaterThan(s.nodes[0].y)
  })

  it('returns the id of the node it created', () => {
    const { nodes } = addNode(empty, 'First')
    expect(nodes[0].id).toMatch(/^node-/)
  })
})
```

- [ ] **Step 2: Rewrite `addNode`**

```ts
export type Anchor = { x: number; y: number }

const ADD_COLUMN_WIDTH = 240
const ADD_ROW_HEIGHT = 150
const ADD_PER_ROW = 4

/**
 * Appends a node, laid out in a grid from `anchor`.
 *
 * The anchor lets the caller drop new nodes at the viewport centre so they
 * are visible immediately. Defaults to the origin so the pure-function
 * tests stay simple.
 */
export function addNode(
  state: EditorState,
  label: string,
  anchor: Anchor = { x: 0, y: 0 },
): EditorState {
  const index = state.nodes.length
  const column = index % ADD_PER_ROW
  const row = Math.floor(index / ADD_PER_ROW)

  return {
    ...state,
    nodes: [
      ...state.nodes,
      {
        id: nextId('node'),
        label,
        x: anchor.x + column * ADD_COLUMN_WIDTH,
        y: anchor.y + row * ADD_ROW_HEIGHT,
      },
    ],
  }
}
```

- [ ] **Step 3: Tests pass (19), commit**

```bash
git add components/map-editor.tsx tests/components/map-editor.test.ts
git commit -m "feat(student-map): let addNode take a viewport anchor"
```

---

## Task 3: Expose the viewport

`MapWorkspace` owns the Add button but `MapEditor` owns the React Flow instance. The workspace needs the viewport centre and a way to pan.

**File:** modify `components/map-editor.tsx`

- [ ] **Step 1: Wrap in a provider and lift an imperative handle**

```tsx
'use client'

import { useCallback, useImperativeHandle, useMemo, type Ref } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Node,
  type NodeChange,
} from '@xyflow/react'

export type MapEditorHandle = {
  /** Graph coordinates at the centre of the visible canvas. */
  viewportCentre: () => Anchor
  /** Smoothly pan to a node. */
  focusNode: (id: string) => void
}
```

Inside the inner component:

```tsx
function EditorInner({
  state,
  onChange,
  onSelect,
  selectedId,
  handleRef,
}: MapEditorProps & { handleRef?: Ref<MapEditorHandle> }) {
  const { screenToFlowPosition, setCenter, getNode } = useReactFlow()

  useImperativeHandle(
    handleRef,
    () => ({
      viewportCentre: () => {
        const el = document.querySelector<HTMLElement>('[data-map-editor]')
        if (!el) return { x: 0, y: 0 }
        const rect = el.getBoundingClientRect()
        // Offset left and up so the node body sits centred, not its corner.
        const centre = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
        return { x: Math.round(centre.x - 90), y: Math.round(centre.y - 20) }
      },
      focusNode: (id: string) => {
        const node = getNode(id)
        if (!node) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        setCenter(node.position.x + 90, node.position.y + 20, {
          zoom: 1,
          duration: reduced ? 0 : 350,
        })
      },
    }),
    [screenToFlowPosition, setCenter, getNode],
  )
```

Tag the container so `viewportCentre` can measure it:

```tsx
<div data-map-editor className="h-[32rem] overflow-hidden rounded-xl border">
```

- [ ] **Step 2: Export the wrapped component**

```tsx
export function MapEditor(
  props: MapEditorProps & { handleRef?: Ref<MapEditorHandle> },
) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
```

Keep `addNode`, `removeNode`, `renameNode`, `toSavePayload` as module-scope exports — the tests import them directly.

---

## Task 4: Wire the workspace

**File:** modify `components/map-workspace.tsx`

- [ ] **Step 1: Hold a handle**

```tsx
import { useRef } from 'react'
import { MapEditor, type MapEditorHandle } from '@/components/map-editor'

const editorRef = useRef<MapEditorHandle | null>(null)
```

- [ ] **Step 2: Use it in `handleAdd`**

```tsx
function handleAdd() {
  const label = newLabel.trim()
  if (!label) return

  const anchor = editorRef.current?.viewportCentre() ?? { x: 0, y: 0 }
  const next = addNode(state, label, anchor)
  const created = next.nodes[next.nodes.length - 1]

  setState(next)
  setNewLabel('')
  setSelectedId(created.id)

  // Pan after React Flow has the node.
  requestAnimationFrame(() => editorRef.current?.focusNode(created.id))
}
```

- [ ] **Step 3: Pass the ref**

```tsx
<MapEditor
  handleRef={editorRef}
  state={state}
  onChange={setState}
  onSelect={setSelectedId}
  selectedId={selectedId}
/>
```

- [ ] **Step 4: Keep focus in the input**

After adding, focus should return to the text field so the learner can type the next concept without reaching for the mouse.

```tsx
const inputRef = useRef<HTMLInputElement | null>(null)
// at the end of handleAdd:
inputRef.current?.focus()
```

Attach `ref={inputRef}` to the concept `Input`.

---

## Task 5: Empty state

A blank dotted grid gives no hint that anything is expected.

**File:** modify `components/map-editor.tsx`

- [ ] **Step 1: Overlay an instruction**

Inside the container, after `<ReactFlow>`:

```tsx
{state.nodes.length === 0 && (
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
    <PenLine data-icon className="size-6 text-muted-foreground" />
    <p className="text-sm font-medium">Your canvas is empty</p>
    <p className="max-w-xs text-xs text-muted-foreground">
      Type a concept above and press Add. Then drag from one node&apos;s right
      edge to another&apos;s left edge to mark a prerequisite.
    </p>
  </div>
)}
```

Make the container `relative`, import `PenLine`.

`pointer-events-none` matters — the overlay must not block panning.

- [ ] **Step 2: Test it**

```ts
it('shows guidance when the canvas is empty', () => {
  render(
    <MapEditor state={{ nodes: [], edges: [] }} onChange={() => {}} onSelect={() => {}} selectedId={null} />,
  )
  expect(screen.getByText('Your canvas is empty')).toBeInTheDocument()
})

it('hides guidance once a node exists', () => {
  render(
    <MapEditor
      state={{ nodes: [{ id: 'n1', label: 'A', x: 0, y: 0 }], edges: [] }}
      onChange={() => {}}
      onSelect={() => {}}
      selectedId={null}
    />,
  )
  expect(screen.queryByText('Your canvas is empty')).not.toBeInTheDocument()
})
```

Create `tests/components/map-editor-render.test.tsx` with the React Flow mock pattern from `tests/components/learn-view.test.tsx`. Keep it separate from the existing `.ts` file, which stays pure.

---

## Task 6: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Live check**

```bash
npm run dev
```

Open `/courses/ai-agents/my-map` — the exact screenshot case.

- [ ] The empty canvas shows guidance, not a blank grid
- [ ] Type `ReAct Pattern`, click **Add** → **the node appears, centred and selected**
- [ ] Focus is back in the input
- [ ] Add `Tool Calling` → lands beside the first, both visible
- [ ] Add four more → wraps to a second row
- [ ] Pan away, then add another → the canvas pans to the new node
- [ ] Drag between handles → an edge appears
- [ ] Click a node, rename it in the toolbar → label updates
- [ ] Delete a node → its edges go with it
- [ ] **Save** → success toast
- [ ] Reload → the map is restored

- [ ] **Step 3: Reduced motion**

Emulate `prefers-reduced-motion: reduce`. Nodes still appear in view; the pan is instant.

- [ ] **Step 4: Commit**

```bash
git add components/map-editor.tsx components/map-workspace.tsx tests/components/map-editor.test.ts tests/components/map-editor-render.test.tsx
git commit -m "fix(student-map): place new nodes in the viewport and pan to them

Add appeared to do nothing: addNode positioned the first node at the origin
while fitView had already run against an empty graph, so it landed offscreen.
New nodes now drop at the viewport centre, get selected, and the canvas pans
to them. Also removes the dead flowNodes state and adds an empty-canvas hint."
```

---

## Exit checklist

- [ ] Adding a concept shows it immediately, centred
- [ ] The new node is selected and ready to rename
- [ ] Focus returns to the input for fast successive adds
- [ ] Successive nodes tile rather than stack
- [ ] The canvas pans to a node added while panned away
- [ ] The empty canvas explains what to do
- [ ] The overlay does not block panning
- [ ] Dead `flowNodes` state is gone
- [ ] Save and reload round-trips
- [ ] All verification commands pass

Next: [`D2-concept-palette.md`](./D2-concept-palette.md).
