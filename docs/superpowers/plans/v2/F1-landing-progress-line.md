# F1 — Landing Progress Line

**Depends on:** nothing. **Blocks:** nothing.

**Problem:** the "How it works" section renders four numbered circles in a grid with nothing joining them. The numbers imply a sequence, but the layout says "four unrelated things." The user asked for a line passing from 1 to 4 that fills in gradually.

**Decision:** a connector line behind the step markers that fills as the section scrolls into view. Horizontal on desktop, vertical on mobile. Fully disabled under `prefers-reduced-motion`, where the line renders complete and static.

---

## Task 1: Scroll progress hook

**File:** create `hooks/use-scroll-progress.ts`, test `tests/hooks/use-scroll-progress.test.ts`

- [ ] **Step 1: Write the failing test**

`IntersectionObserver` does not exist in jsdom, so stub it.

```ts
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollProgress } from '@/hooks/use-scroll-progress'

let observerCallback: IntersectionObserverCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

beforeEach(() => {
  observerCallback = null
  observe.mockClear()
  disconnect.mockClear()

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
      takeRecords = vi.fn()
      root = null
      rootMargin = ''
      thresholds = []
    },
  )

  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe('useScrollProgress', () => {
  it('starts at zero', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBe(0)
  })

  it('returns a ref to attach', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.ref).toHaveProperty('current')
  })

  it('observes once the ref is attached', () => {
    const { result } = renderHook(() => useScrollProgress())
    const el = document.createElement('div')
    result.current.ref.current = el
    expect(observe).toHaveBeenCalledTimes(0)
  })

  it('reports full progress immediately under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBe(1)
  })

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useScrollProgress())
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('clamps progress to 0..1', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBeGreaterThanOrEqual(0)
    expect(result.current.progress).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Implement**

```ts
'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Reports how far a element has travelled through the viewport, 0 to 1.
 *
 * Returns 1 immediately when the user prefers reduced motion, so the
 * caller can render a completed state rather than an animation.
 */
export function useScrollProgress() {
  const ref = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduced) {
      setProgress(1)
      return
    }

    const element = ref.current
    if (!element) return

    let frame = 0

    const update = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight

      // 0 when the top edge enters from below, 1 when the element has
      // travelled most of the way up. The 0.6 keeps the fill finishing
      // before the section leaves view entirely.
      const travelled = viewport - rect.top
      const span = viewport * 0.6 + rect.height * 0.4

      setProgress(Math.min(1, Math.max(0, travelled / span)))
    }

    const onScroll = () => {
      // Coalesce to one update per frame.
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', onScroll, { passive: true })
          update()
        } else {
          window.removeEventListener('scroll', onScroll)
        }
      },
      { threshold: 0 },
    )

    observer.observe(element)
    update()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return { ref, progress }
}
```

The `IntersectionObserver` is there so the scroll listener only runs while the section is actually on screen.

- [ ] **Step 3: Tests pass (6), commit**

```bash
git add hooks/use-scroll-progress.ts tests/hooks/use-scroll-progress.test.ts
git commit -m "feat(ui): add scroll progress hook with reduced-motion support"
```

---

## Task 2: The steps component

**File:** create `components/how-it-works.tsx`, test `tests/components/how-it-works.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HowItWorks } from '@/components/how-it-works'

vi.mock('@/hooks/use-scroll-progress', () => ({
  useScrollProgress: () => ({ ref: { current: null }, progress: 0.5 }),
}))

const steps = [
  { title: 'Assess', description: 'A short diagnostic finds where your understanding stops.' },
  { title: 'Learn', description: 'The tutor explains the next concept in prerequisite order.' },
  { title: 'Prove it', description: 'Short answers are graded on understanding.' },
  { title: 'Adapt', description: 'Your mastery scores reshape what comes next.' },
]

describe('HowItWorks', () => {
  it('renders the section heading', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
  })

  it('renders every step title', () => {
    render(<HowItWorks steps={steps} />)
    for (const s of steps) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
    }
  })

  it('numbers the steps from one', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders a connector track', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByTestId('step-track')).toBeInTheDocument()
  })

  it('scales the fill to reported progress', () => {
    render(<HowItWorks steps={steps} />)
    const fill = screen.getByTestId('step-fill')
    expect(fill).toHaveStyle({ transform: 'scaleX(0.5)' })
  })

  it('marks steps the fill has reached', () => {
    render(<HowItWorks steps={steps} />)
    // progress 0.5 of 4 steps reaches steps 1 and 2.
    expect(screen.getByTestId('step-marker-0')).toHaveAttribute('data-reached', 'true')
    expect(screen.getByTestId('step-marker-3')).toHaveAttribute('data-reached', 'false')
  })

  it('hides the connector from assistive tech', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByTestId('step-track')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders an ordered list for semantics', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Build it**

```tsx
'use client'

import { useScrollProgress } from '@/hooks/use-scroll-progress'
import { cn } from '@/lib/utils'

export type Step = {
  title: string
  description: string
}

export function HowItWorks({ steps }: { steps: Step[] }) {
  const { ref, progress } = useScrollProgress()

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20"
    >
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        How it works
      </h2>

      <div className="relative">
        {/* Connector. Vertical on mobile, horizontal from sm up. */}
        <div
          data-testid="step-track"
          aria-hidden="true"
          className={cn(
            'absolute bg-border',
            // mobile: a vertical line down the left, behind the markers
            'left-5 top-0 h-full w-px',
            // desktop: a horizontal line across the marker row
            'sm:left-0 sm:top-5 sm:h-px sm:w-full',
          )}
        >
          <div
            data-testid="step-fill"
            style={{ transform: `scaleX(${progress})` }}
            className={cn(
              'h-full w-full origin-top bg-primary sm:origin-left',
              'transition-transform duration-300 ease-out',
              // On mobile the line is vertical, so scale the other axis.
              'max-sm:[transform:scaleY(var(--p))]',
            )}
          />
        </div>

        <ol className="relative grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {steps.map((step, index) => {
            // A marker is "reached" once the fill passes its position.
            const position = steps.length > 1 ? index / (steps.length - 1) : 0
            const reached = progress >= position

            return (
              <li
                key={step.title}
                className="flex gap-4 sm:flex-col sm:items-center sm:gap-3 sm:text-center"
              >
                <div
                  data-testid={`step-marker-${index}`}
                  data-reached={reached}
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    'border-2 text-sm font-semibold',
                    'transition-colors duration-300',
                    reached
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {index + 1}
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
```

The mobile vertical variant needs a CSS variable rather than an arbitrary-value transform. Set it inline:

```tsx
style={{
  transform: `scaleX(${progress})`,
  ['--p' as string]: String(progress),
}}
```

- [ ] **Step 3: Tests pass (8), commit**

```bash
git add components/how-it-works.tsx tests/components/how-it-works.test.tsx
git commit -m "feat(landing): add connected step progression"
```

---

## Task 3: Use it on the landing page

**File:** modify `app/page.tsx`

- [ ] **Step 1: Replace the inline section**

Delete the `{/* How it works */}` section entirely and replace with:

```tsx
<HowItWorks steps={STEPS} />
```

Keep the existing `STEPS` array. Add the import.

- [ ] **Step 2: Check it is a client boundary**

`app/page.tsx` is a Server Component that calls `listCourses`. `HowItWorks` is `'use client'`, so importing it is fine — it becomes a client island. No change needed.

- [ ] **Step 3: Remove dead code**

If `STEPS` was only used in the deleted JSX, it stays — it is now the prop. But check for any now-unused imports:

```bash
npx eslint app/page.tsx
```

---

## Task 4: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Desktop behaviour**

```bash
npm run dev
```

Open `/` and scroll slowly to "How it works".

- [ ] A horizontal line runs behind all four markers
- [ ] The line fills left to right as the section rises
- [ ] Markers turn primary as the fill reaches them
- [ ] By the time the section is centred, all four are filled
- [ ] Scrolling back up reverses it

- [ ] **Step 3: Mobile behaviour**

Resize to 375px.

- [ ] Markers stack with a vertical connector on the left
- [ ] The line fills top to bottom
- [ ] Text sits beside each marker, not under it
- [ ] Nothing overflows horizontally

- [ ] **Step 4: Reduced motion**

Emulate `prefers-reduced-motion: reduce` and reload.

- [ ] The line is fully filled on load
- [ ] All four markers are primary
- [ ] No animation on scroll

- [ ] **Step 5: Both themes**

Toggle dark/light. The unfilled track should be visible but quiet in both.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(landing): connect the how-it-works steps with a scroll-filled line

Four numbered circles in a grid read as four unrelated items. A connector
that fills as the section scrolls makes the sequence legible. Renders
complete and static under prefers-reduced-motion."
```

---

## Exit checklist

- [ ] A connector joins all four steps
- [ ] It fills progressively on scroll
- [ ] Markers activate as the fill reaches them
- [ ] Horizontal on desktop, vertical on mobile
- [ ] Complete and static under reduced motion
- [ ] Connector hidden from assistive tech; the list stays semantic
- [ ] Legible in both themes
- [ ] All four verification commands pass

Next: [`F2-sidebar-rail-seam.md`](./F2-sidebar-rail-seam.md).
