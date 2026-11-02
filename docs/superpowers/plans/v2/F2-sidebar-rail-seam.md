# F2 — Sidebar Rail Seam

**Depends on:** nothing. **Blocks:** nothing.

**Problem:** a short vertical line artifact sits at the top-left of the app shell, just right of the sidebar edge, level with the header. The user screenshotted it twice. An earlier pass height-matched `SidebarHeader` to the inset header and darkened the sidebar surface — the seam is still there.

**Cause:** `SidebarRail`, the invisible drag handle for resizing the sidebar.

```
components/ui/sidebar.tsx:292
"absolute inset-y-0 z-20 hidden w-4 ... group-data-[side=left]:-right-4
 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px]
 hover:after:bg-sidebar-border sm:flex ..."
```

The `::after` pseudo-element is a 2px full-height strip positioned `-right-4`, which places it **inside the inset**, overlapping the header. It is meant to be transparent until hover, but it inherits a background in some states and renders as a visible sliver against the header's `bg-background`.

Two contributing factors:

1. `z-20` puts it above the header's `z-10`, so it draws on top
2. `inset-y-0` spans the full viewport height, including the header band where it has no business being

---

## Task 1: Confirm the diagnosis

Do not change anything until the cause is proven. The earlier fix addressed a different seam and left this one.

- [ ] **Step 1: Find it in the DOM**

```bash
npm run dev
```

Open any page inside the shell. In devtools, inspect the element at the artifact's location, or run in the console:

```js
document.querySelector('[data-slot="sidebar-rail"]')?.getBoundingClientRect()
```

Expected: a rect starting at `y: 0`, roughly `x: 252`, `width: 16`, full viewport height. It overlaps the header band.

- [ ] **Step 2: Prove it is the culprit**

```js
document.querySelector('[data-slot="sidebar-rail"]').style.display = 'none'
```

The artifact should disappear. If it does not, stop — the cause is something else, and the rest of this chunk is wrong.

- [ ] **Step 3: Check whether the rail is wanted at all**

```bash
grep -rn "SidebarRail" --include="*.tsx" components app
```

At time of writing: defined and exported in `components/ui/sidebar.tsx`, **never rendered**. If `AppShell` does not use it, Base UI's `Sidebar` may render it internally — confirm by checking whether the element exists in the DOM despite no explicit usage.

---

## Task 2: Fix it

Pick the branch that matches what Step 3 found.

### Branch A — the rail is rendered but unused

If nothing in the app renders `<SidebarRail />` and the DOM element comes from inside `Sidebar`, the cleanest fix is to stop it covering the header.

- [ ] **Step 1: Constrain it below the header**

In `components/ui/sidebar.tsx`, in the `SidebarRail` className:

```tsx
className={cn(
  // Start below the 56px inset header so the hover strip cannot draw
  // over it. z-0 keeps it under the sticky header regardless.
  "absolute inset-y-0 top-14 z-0 hidden w-4 transition-all ease-linear",
  "group-data-[side=left]:-right-4 group-data-[side=right]:left-0",
  "after:absolute after:inset-y-0 after:start-1/2 after:w-[2px]",
  "after:bg-transparent hover:after:bg-sidebar-border",
  "sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
  // ... keep the remaining cursor and collapsible rules unchanged
)}
```

Three changes:
- `top-14` — starts below the header
- `z-20` → `z-0` — never above the sticky header
- `after:bg-transparent` — explicit default so no inherited background bleeds through

### Branch B — the rail is genuinely not needed

The sidebar is `collapsible="icon"` and already has a `SidebarTrigger` in the header. A drag-to-resize handle adds nothing.

- [ ] **Step 1: Make it opt-in**

Add a guard at the top of `SidebarRail`:

```tsx
function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { collapsible } = useSidebar()

  // The icon-collapsible sidebar is toggled by SidebarTrigger. A drag rail
  // adds nothing and its hover strip overlaps the inset header.
  if (collapsible === "icon") return null

  // ... existing implementation
}
```

Check that `useSidebar()` actually exposes `collapsible`. If not, thread it through the context or use a simpler `if (true) return null` with a comment explaining the sidebar is trigger-driven.

---

## Task 3: Verify the header junction

With the rail handled, confirm the corner where sidebar meets header is clean.

- [ ] **Step 1: Check the border alignment**

```bash
grep -n "SidebarHeader" -A 3 components/app-shell.tsx
grep -n 'className="sticky top-0' components/app-shell.tsx
```

Both should be `h-14`:
- `SidebarHeader` → `h-14 justify-center border-b border-sidebar-border`
- Inset header → `sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4`

- [ ] **Step 2: Confirm the borders meet**

In devtools, measure both elements. Their bottom edges must be at the same `y`. A 1px difference reads as a step in the line.

If they differ, the cause is usually padding inside `SidebarHeader` pushing content taller than `h-14`. `justify-center` plus a fixed height should prevent that, but verify with `getBoundingClientRect().height` on both.

- [ ] **Step 3: Check the vertical border continuity**

The sidebar container has `group-data-[side=left]:border-r`. The inset has no left border. So exactly one 1px line separates them — correct. Two borders would read as a 2px seam.

```js
getComputedStyle(document.querySelector('[data-slot="sidebar-container"]')).borderRightWidth
getComputedStyle(document.querySelector('[data-slot="sidebar-inset"]')).borderLeftWidth
```

Expected: `1px` and `0px`.

---

## Task 4: Regression test

A pure CSS artifact is hard to assert on, but the structural facts that caused it are testable.

**File:** create `tests/components/app-shell.test.tsx`

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarProvider, SidebarRail } from '@/components/ui/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
}))

describe('SidebarRail', () => {
  it('does not cover the header band', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')

    // Either suppressed entirely, or offset below the 56px header.
    if (rail) {
      expect(rail.className).toContain('top-14')
    } else {
      expect(rail).toBeNull()
    }
  })

  it('never sits above the sticky header', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')
    if (rail) {
      expect(rail.className).not.toContain('z-20')
    }
  })

  it('keeps its indicator transparent until hover', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')
    if (rail) {
      expect(rail.className).toContain('hover:after:bg-sidebar-border')
    }
  })
})
```

The conditionals handle both branches from Task 2 — the test passes whether the rail is suppressed or repositioned.

---

## Task 5: Verify and commit

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Visual check at the exact location**

```bash
npm run dev
```

Zoom the browser to 200% and look at the top-left corner where the sidebar meets the header.

- [ ] No vertical sliver right of the sidebar border
- [ ] The sidebar's right border and the header's bottom border meet cleanly
- [ ] The corner is a clean right angle, no step or overlap

- [ ] **Step 3: Check every sidebar state**

- [ ] Expanded — no artifact
- [ ] Collapsed to icons (click the trigger) — no artifact
- [ ] Mid-transition — no flash of the line
- [ ] Scrolled down with the header stuck — no artifact
- [ ] Mobile width, sidebar as a sheet — no artifact

- [ ] **Step 4: Both themes**

The seam was most visible in dark mode where `bg-sidebar` and `bg-background` differ most. Check both.

- [ ] **Step 5: Commit**

```bash
git add components/ui/sidebar.tsx tests/components/app-shell.test.tsx
git commit -m "fix(ui): stop the sidebar rail drawing over the header

SidebarRail's ::after hover indicator is a 2px full-height strip at
-right-4 with z-20, which places it inside the inset and above the sticky
header. An earlier pass fixed the header/sidebar border alignment but left
this. The rail now starts below the header band and sits beneath it."
```

---

## Exit checklist

- [ ] The artifact is gone at 100% and 200% zoom
- [ ] Verified by toggling the rail in devtools before fixing
- [ ] Clean in expanded, collapsed, and transitioning states
- [ ] Clean when scrolled with the header stuck
- [ ] Clean in both themes
- [ ] Exactly one border between sidebar and inset
- [ ] Sidebar header and inset header are both 56px with aligned bottom edges
- [ ] Regression test covers position and stacking
- [ ] All four verification commands pass

Part F complete. Next: [`G1-diagnostic-assessment.md`](./G1-diagnostic-assessment.md) — the cold-start problem.
