# D2 — Concept Palette

**Depends on:** D1. **Blocks:** nothing.

**Problem:** the student map opens on a blank canvas with a free-text input. A learner is asked to recall concept names from memory and type them exactly — and the comparison in `lib/map-compare.ts` only tolerates roughly one typo per six characters, so a slightly wrong name is scored as an unrecognised node.

That punishes spelling, not understanding.

**Decision:** offer the course's real concepts as a palette. The learner picks which ones belong and arranges them. Free text stays for anything they want to add that is not in the course.

This is the right pedagogy too. The hard part of a concept map is the **structure** — what depends on what — not remembering a list of nouns.

---

## Task 1: Serve the concept list

**Files:** modify `app/courses/[slug]/my-map/page.tsx`

`getCourseGraph(slug)` already returns everything needed.

- [ ] **Step 1: Fetch alongside the saved map**

```tsx
import { getCourseGraph } from '@/lib/repositories/concept'

const [course, maps, graph] = await Promise.all([
  findCourseBySlug(slug),
  listStudentMaps(user.id, slug),
  getCourseGraph(slug),
])

if (!course || !graph) notFound()
```

- [ ] **Step 2: Pass a minimal palette**

Only name and difficulty — the canvas does not need definitions.

```tsx
<MapWorkspace
  courseSlug={slug}
  conceptPalette={graph.concepts.map((c) => ({
    name: c.name,
    difficulty: c.difficulty,
  }))}
  initial={latest ? { ... } : null}
/>
```

Deliberately **not** passing concept ids. The learner is recalling structure from memory; handing over ids would let the comparison match on identity rather than on what they actually wrote.

---

## Task 2: The palette component

**File:** create `components/concept-palette.tsx`, test `tests/components/concept-palette.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConceptPalette } from '@/components/concept-palette'

const palette = [
  { name: 'Tokenization', difficulty: 'BEGINNER' as const },
  { name: 'Embeddings', difficulty: 'BEGINNER' as const },
  { name: 'Attention', difficulty: 'INTERMEDIATE' as const },
]

describe('ConceptPalette', () => {
  it('renders one chip per concept', () => {
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Attention/ })).toBeInTheDocument()
  })

  it('calls onAdd with the concept name', async () => {
    const onAdd = vi.fn()
    const u = userEvent.setup()
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={onAdd} />)
    await u.click(screen.getByRole('button', { name: /Tokenization/ }))
    expect(onAdd).toHaveBeenCalledWith('Tokenization')
  })

  it('disables a concept already on the canvas', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeDisabled()
  })

  it('matches used labels case-insensitively', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeDisabled()
  })

  it('leaves unused concepts enabled', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Embeddings/ })).toBeEnabled()
  })

  it('reports how many are placed', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByText('1 of 3 placed')).toBeInTheDocument()
  })

  it('renders nothing when the palette is empty', () => {
    const { container } = render(
      <ConceptPalette concepts={[]} usedLabels={[]} onAdd={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('can be hidden to test recall from memory', async () => {
    const u = userEvent.setup()
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={() => {}} />)
    await u.click(screen.getByRole('button', { name: /Hide/ }))
    expect(screen.queryByRole('button', { name: /Tokenization/ })).not.toBeInTheDocument()
  })

  it('does not fire onAdd for a disabled concept', async () => {
    const onAdd = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={onAdd} />,
    )
    await u.click(screen.getByRole('button', { name: /Tokenization/ }))
    expect(onAdd).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Build it**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/lib/schemas/common'

export type PaletteConcept = {
  name: string
  difficulty: Difficulty
}

export function ConceptPalette({
  concepts,
  usedLabels,
  onAdd,
}: {
  concepts: PaletteConcept[]
  usedLabels: string[]
  onAdd: (name: string) => void
}) {
  const [visible, setVisible] = useState(true)

  const used = useMemo(
    () => new Set(usedLabels.map((l) => l.trim().toLowerCase())),
    [usedLabels],
  )

  if (concepts.length === 0) return null

  const placed = concepts.filter((c) => used.has(c.name.toLowerCase())).length

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Concepts in this course</h3>
            <p className="text-xs text-muted-foreground">
              {placed} of {concepts.length} placed
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff data-icon /> : <Eye data-icon />}
            {visible ? 'Hide' : 'Show'}
          </Button>
        </div>

        {visible ? (
          <div className="flex flex-wrap gap-2">
            {concepts.map((concept) => {
              const isUsed = used.has(concept.name.toLowerCase())
              return (
                <button
                  key={concept.name}
                  type="button"
                  disabled={isUsed}
                  onClick={() => onAdd(concept.name)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5',
                    'text-xs font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isUsed
                      ? 'cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground opacity-60'
                      : 'cursor-pointer border-border bg-background hover:border-primary/40 hover:bg-accent hover:shadow-sm',
                  )}
                >
                  {!isUsed && <Plus data-icon className="size-3" />}
                  <span>{concept.name}</span>
                  <DifficultyBadge difficulty={concept.difficulty} />
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Hidden. Recall what belongs, then reveal to check.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

The **Hide** toggle is the point. A learner who wants to test genuine recall hides the palette, builds from memory, then reveals it to see what they forgot.

- [ ] **Step 3: Tests pass (9), commit**

```bash
git add components/concept-palette.tsx tests/components/concept-palette.test.tsx
git commit -m "feat(student-map): add course concept palette"
```

---

## Task 3: Wire it in

**File:** modify `components/map-workspace.tsx`

- [ ] **Step 1: Accept the palette**

```tsx
export function MapWorkspace({
  courseSlug,
  conceptPalette,
  initial,
}: {
  courseSlug: string
  conceptPalette: PaletteConcept[]
  initial: ({ id: string; title: string } & EditorState) | null
})
```

- [ ] **Step 2: Share the add path**

Palette clicks and the text input must behave identically.

```tsx
const addConcept = useCallback(
  (label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return

    const anchor = editorRef.current?.viewportCentre() ?? { x: 0, y: 0 }
    const next = addNode(state, trimmed, anchor)
    const created = next.nodes[next.nodes.length - 1]

    setState(next)
    setSelectedId(created.id)
    requestAnimationFrame(() => editorRef.current?.focusNode(created.id))
  },
  [state],
)

function handleAdd() {
  addConcept(newLabel)
  setNewLabel('')
  inputRef.current?.focus()
}
```

- [ ] **Step 3: Render the palette above the canvas**

```tsx
<ConceptPalette
  concepts={conceptPalette}
  usedLabels={state.nodes.map((n) => n.label)}
  onAdd={addConcept}
/>
```

- [ ] **Step 4: Soften the free-text input**

It is now the secondary path.

```tsx
<Input
  ref={inputRef}
  value={newLabel}
  onChange={(e) => setNewLabel(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
  placeholder="Or add your own concept..."
  className="max-w-xs"
/>
```

---

## Task 4: Rewrite the instructions

The current copy is one dense paragraph.

**File:** modify `app/courses/[slug]/my-map/page.tsx`

- [ ] **Step 1: Replace the header text**

```tsx
<header className="flex flex-col gap-2">
  <h1 className="text-2xl font-semibold tracking-tight">
    Draw your own map
  </h1>
  <p className="max-w-2xl text-sm text-muted-foreground">
    Pick the concepts you think belong, then connect them. Drag from a
    node&apos;s right edge to another&apos;s left edge to mark a prerequisite.
    Compare when you are done to see where your model differs from the course.
  </p>
  <p className="max-w-2xl text-xs text-muted-foreground">
    Hide the palette first if you want to test what you can recall unaided.
  </p>
</header>
```

---

## Task 5: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 2: Live check**

Open `/courses/generative-ai/my-map`.

- [ ] The palette lists all 11 concepts with difficulty badges
- [ ] It reads `0 of 11 placed`
- [ ] Clicking **Tokenization** adds it, centred and selected
- [ ] That chip is now disabled and dimmed
- [ ] The counter reads `1 of 11 placed`
- [ ] Add three more, connect two → edges render
- [ ] **Hide** collapses the palette with an explanatory line
- [ ] **Show** restores it with disabled states intact
- [ ] Free text still adds a concept not in the list
- [ ] **Save**, reload → palette correctly shows placed concepts as used
- [ ] **Compare** → a map built from the palette scores high, since names match exactly

- [ ] **Step 3: Check the comparison improves**

Build a map of 5 palette concepts with correct prerequisite edges, then Compare.

Expected: no entries under **Not in this course** — the whole class of spelling-related false negatives is gone.

- [ ] **Step 4: Commit**

```bash
git add components/map-workspace.tsx "app/courses/[slug]/my-map/page.tsx"
git commit -m "feat(student-map): offer the course concepts as a palette

Typing names from memory meant a one-character slip scored as an
unrecognised node, punishing spelling rather than understanding. The
palette supplies exact names, with a Hide toggle for learners who want to
test unaided recall. Free text remains for concepts outside the course."
```

---

## Exit checklist

- [ ] The palette lists every concept in the course
- [ ] Clicking adds a correctly named node in view
- [ ] Placed concepts are disabled and visibly dimmed
- [ ] The counter tracks progress
- [ ] Hide/Show works and explains itself
- [ ] Free text still available
- [ ] Palette state survives save and reload
- [ ] Palette-built maps no longer produce spelling false negatives
- [ ] All verification commands pass

Part D complete. Next: [`E1-recommendation-copy.md`](./E1-recommendation-copy.md).
