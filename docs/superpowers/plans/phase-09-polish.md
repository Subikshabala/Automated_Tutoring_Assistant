# Phase 9 — Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.
>
> **Design note:** Task 2 (landing page) and Task 3 (visual pass) are design work, not mechanical implementation. Route them to a design-capable agent and load the `ui-ux-pro-max` skill before writing any markup. The remaining tasks are mechanical and can be executed directly.

**Goal:** Turn a working prototype into something that holds up under a real demo — a landing page that explains the product, consistent loading and error states on every route, keyboard and screen-reader access, and a clean production build.

**Architecture:** No new domain logic. This phase adds presentation surfaces (`app/page.tsx`), fills gaps in existing route segments (`loading.tsx`, `error.tsx`, `not-found.tsx`), and hardens what is already there. Every change is additive or cosmetic.

**Tech Stack:** Next.js 16 · shadcn/ui · Tailwind v4

**Depends on:** Phase 8 complete.

**Done when:** `npm run build` succeeds, every route has a loading and error state, the app is navigable by keyboard, and the landing page explains the product to someone who has never seen it.

---

## File Structure

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Landing page |
| `app/error.tsx` | Root error boundary |
| `app/not-found.tsx` | Root 404 |
| `app/global-error.tsx` | Fatal error fallback |
| `app/courses/[slug]/loading.tsx` | Course detail skeleton |
| `app/materials/loading.tsx` | Materials skeleton |
| `app/assessment/[id]/loading.tsx` | Assessment skeleton |
| `app/profile/loading.tsx` | Profile skeleton |
| `app/admin/loading.tsx` | Admin skeleton |
| `components/empty-state.tsx` | Shared empty-state wrapper |
| `PROGRESS.md` | Session handoff document |
| `README.md` | Setup and run instructions |

---

## Task 1: Error and not-found boundaries

A thrown error currently shows the Next.js default overlay in dev and a blank page in production. Fix that first — it is the cheapest reliability win in the phase.

**Files:**
- Create: `app/error.tsx`
- Create: `app/not-found.tsx`
- Create: `app/global-error.tsx`

- [ ] **Step 1: Create `app/error.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert data-icon />
        </EmptyMedia>
        <EmptyTitle>Something broke</EmptyTitle>
        <EmptyDescription>
          {error.message || 'An unexpected error occurred on this page.'}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-60">
              {error.digest}
            </span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>
          <RotateCcw data-icon />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
```

- [ ] **Step 2: Create `app/not-found.tsx`**

```tsx
import Link from 'next/link'
import { Compass, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX data-icon />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          That page does not exist. It may have moved.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/explore" />}>
          <Compass data-icon />
          Browse courses
        </Button>
      </EmptyContent>
    </Empty>
  )
}
```

- [ ] **Step 3: Create `app/global-error.tsx`**

This catches failures in the root layout itself, so it must render its own `<html>` and cannot use any provider or themed component.

```tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          The application failed to load
        </h1>
        <p style={{ color: '#666', maxWidth: '32rem' }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify the error boundary fires**

Temporarily add `throw new Error('boundary test')` at the top of `app/explore/page.tsx`, run `npm run dev`, and open `/explore`.
Expected: the **Something broke** empty state renders inside the app shell, with a working **Try again** button. Remove the throw.

- [ ] **Step 5: Verify the 404**

Open `/this-route-does-not-exist`.
Expected: the **Page not found** state renders inside the shell.

- [ ] **Step 6: Commit**

```bash
git add app/error.tsx app/not-found.tsx app/global-error.tsx
git commit -m "feat(ui): add error, not-found and global-error boundaries"
```

---

## Task 2: Landing page

> **Route this task to a design-capable agent.** Load the `ui-ux-pro-max` skill first. The structure below is a brief, not a final design — the implementer should exercise judgment on hierarchy, spacing, rhythm and motion within it.

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

The landing page must not render inside the sidebar shell. It needs its own full-bleed layout.

- [ ] **Step 1: Make the shell conditional**

The root layout currently wraps everything in `AppShell`. Move that decision into a small client component that checks the path.

Create `components/conditional-shell.tsx`:

```tsx
'use client'

import { usePathname } from 'next/navigation'

const BARE_ROUTES = ['/', '/login', '/register']

export function ConditionalShell({
  shell,
  children,
}: {
  shell: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>
  }
  return <>{shell}</>
}
```

This takes a pre-rendered shell as a prop rather than rendering `AppShell` itself, because `AppShell` is an async Server Component and cannot be called from a client component.

- [ ] **Step 2: Wire it into `app/layout.tsx`**

```tsx
        <ThemeProvider>
          <QueryProvider>
            <ConditionalShell shell={<AppShell>{children}</AppShell>}>
              {children}
            </ConditionalShell>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
```

Add the import: `import { ConditionalShell } from '@/components/conditional-shell'`.

- [ ] **Step 3: Write the landing page**

Replace `app/page.tsx`. The content brief:

**Header** — product name left, theme toggle and sign-in/get-started right. Sticky, with a subtle bottom border that only appears on scroll if the implementer wants it.

**Hero** — one sentence that states what the product does, not what it aspires to be. Suggested copy, which the implementer may tighten but should not inflate:

> *Headline:* Learn what you actually do not know.
> *Subhead:* An AI tutor that assesses your understanding concept by concept, then teaches exactly the gaps — grounded in a real prerequisite map, not a linear syllabus.

Two actions: **Start learning** → `/explore` (primary), **See a concept map** → `/courses/generative-ai/map` (secondary).

**Proof strip** — the three seeded courses, pulled live from the database via `listCourses({})`, rendered with the existing `CourseCard`. Not placeholder copy. If the database is empty the strip should be omitted entirely rather than showing a skeleton forever.

**How it works** — four steps, each one sentence:
1. *Assess* — A short diagnostic finds where your understanding actually stops.
2. *Learn* — The tutor explains the next concept in the order the prerequisites demand.
3. *Prove it* — Short answers are graded on understanding, not keyword matching.
4. *Adapt* — Your mastery scores reshape what comes next.

**Differentiators** — three cards, each a real capability already built:
- *Concept maps, not syllabi* — Every course is a prerequisite graph. You are never sent to a topic you are not ready for.
- *Draw your own map* — Sketch what you think connects to what, then compare it against the canonical structure and see exactly where your model is wrong.
- *Bring your own material* — Upload lecture notes or a paper. Answers come only from that document, with the supporting passages quoted.

**Footer** — product name, a line of honest framing, links to `/explore` and `/login`.

Implementation constraints:
- Use existing shadcn components. Do not introduce a new UI dependency.
- Use semantic colour tokens (`text-muted-foreground`, `bg-card`, `border-border`) so dark mode works without extra work.
- `gap-*` on flex and grid containers, never `space-y-*`.
- Every Lucide icon inside a shadcn component carries `data-icon`.
- No stock marketing phrases: no "revolutionary", no "supercharge", no "unlock your potential", no exclamation marks.
- Must be legible and usable at 375px wide.

- [ ] **Step 4: Check it in both themes**

Run: `npm run dev`, open `/`.
Expected: the page renders without the sidebar. Toggle dark mode — no washed-out text, no invisible borders, no hardcoded colour that fails to flip.

- [ ] **Step 5: Check it at mobile width**

Resize to 375px.
Expected: nothing overflows horizontally, the hero copy stays readable, and the course strip stacks rather than squashing.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/layout.tsx components/conditional-shell.tsx
git commit -m "feat(ui): add landing page outside the app shell"
```

---

## Task 3: Loading states for every route

A route segment without `loading.tsx` blocks on its server work with no feedback. Several pages do real AI calls, so this is not cosmetic.

**Files:**
- Create: `app/courses/[slug]/loading.tsx`
- Create: `app/materials/loading.tsx`
- Create: `app/materials/[id]/loading.tsx`
- Create: `app/assessment/[id]/loading.tsx`
- Create: `app/profile/loading.tsx`
- Create: `app/admin/loading.tsx`

- [ ] **Step 1: Audit what is missing**

Run: `find app -name "page.tsx" | sed 's|/page.tsx||' | while read d; do [ -f "$d/loading.tsx" ] || echo "missing: $d"; done`
Expected: lists the segments without a loading file. `app` itself, `app/login` and `app/register` do not need one — they have no async work.

- [ ] **Step 2: Create `app/courses/[slug]/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-5 w-64" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/materials/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/materials/[id]/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 5: Create `app/assessment/[id]/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-2 w-full" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create `app/profile/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 7: Create `app/admin/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Re-run the audit**

Run the same `find` command from Step 1.
Expected: only `app`, `app/login` and `app/register` remain, which is correct.

- [ ] **Step 9: Verify a slow route shows its skeleton**

Open `/learn/generative-ai/<topicId>` with a cold cache (clear the explanation cache first: `npx prisma db execute --stdin <<< "DELETE FROM ConceptExplanation;"`).
Expected: the skeleton appears immediately, then the real content replaces it. No blank screen.

- [ ] **Step 10: Commit**

```bash
git add app/courses app/materials app/assessment app/profile app/admin
git commit -m "feat(ui): add loading skeletons to every async route segment"
```

---

## Task 4: Keyboard and screen reader pass

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/app-shell.tsx`
- Modify: various components as the audit finds issues

- [ ] **Step 1: Add a skip link**

In `components/app-shell.tsx`, add this as the first child inside `SidebarProvider`:

```tsx
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
```

Then give the `<main>` element the matching id:

```tsx
        <main id="main-content" className="flex flex-1 flex-col gap-6 p-6">
```

- [ ] **Step 2: Tab through the app**

Run: `npm run dev`. Starting at `/explore`, press Tab repeatedly without touching the mouse.

Check each of these and fix what fails:
- The skip link appears as the first focusable element and works.
- Every interactive element shows a visible focus ring.
- Focus order follows visual order — no jumping backwards.
- The sidebar collapse trigger is reachable and operable with Enter or Space.
- Course cards are reachable and Enter navigates.
- The theme toggle and user menu are reachable; the menu opens with Enter and closes with Escape.

- [ ] **Step 3: Check the forms**

On `/register`, tab through. Expected: each input is announced by its label — the `FieldLabel` `htmlFor` must match the input `id`. Submit with an empty form and confirm the browser validation message is attached to the right field.

On `/assessment/<id>`, tab through an MCQ. Expected: arrow keys move between radio options, and each option is announced with its text.

- [ ] **Step 4: Fix icon-only buttons**

Run: `grep -rn 'size="icon"' --include="*.tsx" components app`

Every match must have an `aria-label`. Expected existing coverage: `ModeToggle`, the tutor chat send button, the delete-concept button in the map workspace, the user menu trigger. Add `aria-label` to any that lack one.

- [ ] **Step 5: Check decorative icons are hidden**

Icons that sit next to text are decorative and should not be announced. The `data-icon` attribute does not do this. For any icon that is purely decorative and adjacent to a text label, add `aria-hidden="true"`.

Do not add it to icon-only buttons — there the icon carries the meaning, and the `aria-label` on the button handles it.

- [ ] **Step 6: Verify colour contrast**

Open devtools, run a Lighthouse accessibility audit on `/explore` and `/progress` in both light and dark mode.
Expected: no contrast failures. The shadcn `neutral` base is compliant by default — failures will come from any custom colour added in Phase 2 (`border-l-emerald-500` and friends) used as text rather than as a border. Those are borders, so they are fine; check anything else flagged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(a11y): add skip link and fix labels on icon-only controls"
```

---

## Task 5: Metadata and production build

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/opengraph-image.tsx`

- [ ] **Step 1: Expand the root metadata**

In `app/layout.tsx`, replace the `metadata` export:

```tsx
export const metadata: Metadata = {
  title: {
    default: 'Adaptive — AI learning that follows your actual understanding',
    template: '%s',
  },
  description:
    'An AI tutor that assesses your understanding concept by concept, then teaches exactly the gaps — grounded in a real prerequisite map.',
  keywords: [
    'adaptive learning',
    'AI tutor',
    'concept map',
    'mastery learning',
  ],
  openGraph: {
    title: 'Adaptive',
    description:
      'Learn what you actually do not know. An AI tutor built on prerequisite graphs and real assessment.',
    type: 'website',
  },
}
```

The `template: '%s'` keeps the per-page titles already set in earlier phases exactly as written, rather than appending a suffix twice.

- [ ] **Step 2: Add an OG image**

Create `app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Adaptive — AI learning that follows your actual understanding'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 24,
          padding: 80,
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.6 }}>Adaptive</div>
        <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.1 }}>
          Learn what you actually
          <br />
          do not know.
        </div>
        <div style={{ fontSize: 28, opacity: 0.7, maxWidth: 820 }}>
          An AI tutor built on prerequisite graphs and real assessment.
        </div>
      </div>
    ),
    size,
  )
}
```

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: completes with no errors. Read the route table it prints — every route should appear, with the AI-backed ones marked dynamic (`ƒ`).

Common failures and their fixes:
- *"Dynamic server usage"* on a page that should be static — add `export const dynamic = 'force-dynamic'` to that page.
- *A type error only the build catches* — `next build` type-checks more strictly than `tsc --noEmit` in some configurations. Fix the reported line.
- *"Module not found: pdf-parse"* — it is only imported dynamically inside a Route Handler, which is correct; if the build still complains, confirm the import is `await import('pdf-parse')` and not a top-level import.

- [ ] **Step 4: Run the production server**

Run: `npm run start`, then walk the full flow at `http://localhost:3000`: landing → register → explore → course → concept map → learn → test yourself → submit → progress → materials → upload → ask → my map → save → compare.

Expected: every step works as it did in dev. Pay attention to anything that behaves differently — those are the bugs worth having found.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/opengraph-image.tsx
git commit -m "feat(seo): expand metadata and add opengraph image"
```

---

## Task 6: Documentation and handoff

**Files:**
- Create: `README.md`
- Create: `PROGRESS.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Adaptive — AI Learning Platform

An AI tutor that assesses understanding concept by concept, then teaches the
gaps in prerequisite order.

## What it does

- **Course catalog** — browse courses organised as prerequisite graphs, not linear syllabi
- **Concept maps** — see every concept in a course and how they depend on one another
- **AI tutor** — Gemini-generated explanations with follow-up chat, grounded in the course definitions
- **Assessment** — generated quizzes; MCQs graded deterministically, short answers graded semantically
- **Mastery tracking** — a score per concept, updated from assessment results
- **Adaptive recommendations** — what to learn, practise or review next, with a reason
- **Your own materials** — upload a PDF or text file and ask questions answered only from it
- **Student concept maps** — draw your own map, compare it against the canonical one, get specific feedback

## Setup

Requires Node 20 or later.

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

- `GEMINI_API_KEY` — get one at https://aistudio.google.com/apikey
- `JWT_SECRET` — generate with `openssl rand -base64 32`

Then set up the database:

```bash
npx prisma migrate dev
npm run db:seed
```

## Running

```bash
npm run dev          # development server on :3000
npm run build        # production build
npm run start        # production server
npm test             # test suite
npm run typecheck    # type check
npm run lint         # lint
```

## Making yourself an admin

Register an account through the UI, then:

```bash
npx tsx scripts/make-admin.ts your@email.com
```

Sign out and back in — the role is carried in the session token.

## Architecture

Single Next.js 16 App Router application. Server-side Route Handlers under
`app/api/` replace a separate backend. Prisma and SQLite for persistence.

| Directory | Contents |
|---|---|
| `app/` | Routes, pages and API handlers |
| `components/` | React components (`ui/` is shadcn-generated) |
| `lib/` | Domain logic, repositories, AI services, schemas |
| `lib/ai/` | Gemini client, prompts, and per-feature AI services |
| `lib/repositories/` | All Prisma access |
| `lib/schemas/` | Zod contracts — the source of truth for types |
| `prisma/` | Schema, migrations, seed data |
| `tests/` | Vitest suite, mirroring the source layout |

### Rules this codebase follows

1. No faked implementations. If something cannot be built, it is not shipped.
2. `GEMINI_API_KEY` is read server-side only and never reaches the client.
3. Every AI response is validated with Zod before it touches the database or the UI.
4. Route Handlers return `{ data }` on success and `{ error: { code, message } }` on failure.
5. Authorisation is enforced in every handler, not only in `proxy.ts`.

## Implementation plans

The phase-by-phase plans used to build this live in
[`docs/superpowers/plans/`](./docs/superpowers/plans/).
```

- [ ] **Step 2: Write `PROGRESS.md`**

```markdown
# Progress

## Done

- [x] Phase 0 — Foundation: Prisma schema, 19 tables, API envelope, Zod contracts, Vitest, app shell
- [x] Phase 1 — Course catalog: 3 seeded courses, 28 concepts, explore and detail pages
- [x] Phase 2 — Concept maps: layered React Flow graph with detail panel
- [x] Phase 3 — AI tutor: Gemini client, structured explanations, chat, explanation cache
- [x] Phase 4 — Assessment: generated quizzes, deterministic MCQ grading, semantic short-answer grading, mastery
- [x] Phase 5 — Materials: PDF and text upload, chunking, keyword retrieval, grounded answers
- [x] Phase 6 — Student maps: editable canvas, save, fuzzy comparison against canonical
- [x] Phase 7 — Adaptive engine: prerequisite-gated recommendations, progress dashboard
- [x] Phase 8 — Auth and admin: bcrypt, JWT sessions, Next.js 16 proxy, role-gated admin
- [x] Phase 9 — Polish: landing page, error boundaries, loading states, a11y, production build

## In progress

- [ ] Nothing

## Next

Candidate follow-ups, none started:

- [ ] Replace keyword retrieval with embeddings — `lib/text/retrieve.ts` is the only file that changes
- [ ] Diagnostic assessment on first course open — the architecture document specifies this; it is not built
- [ ] Misconception tracking — the `Misconception` table exists and is unused
- [ ] `LearningSession` and `LearningProgress` — tables exist, nothing writes to them
- [ ] Admin course authoring — `/admin` is read-only
- [ ] Source management UI — the `Source` table exists and is unused

## Notes

**Deliberate simplifications.** Retrieval is TF-IDF over stored chunks, not vector
search — deterministic, testable, and adequate at this corpus size. Map
comparison uses Levenshtein label matching rather than embeddings, for the same
reason. Both are isolated behind single modules and can be swapped without
touching their callers.

**Where the model is and is not trusted.** Gemini writes explanations, grades
short answers, and phrases feedback. It does not decide what to recommend, does
not compute mastery, and does not judge concept-map correctness — those are
pure functions in `lib/adaptive.ts`, `lib/mastery.ts` and `lib/map-compare.ts`.
Every model response passes through a Zod schema in `lib/ai/gemini.ts` before
anything downstream sees it.

**Graceful degradation.** Map feedback (`lib/ai/map-feedback.ts`) and the coach
summary (`lib/ai/coach.ts`) fall back to deterministic text when the model
fails, because the underlying computation is still valid without prose.
Explanations do not fall back — a fabricated explanation would be worse than an
error, so the learn page shows an inline failure for that concept only.

**Prisma 7 gotchas.** The generator is `prisma-client`, not `prisma-client-js`.
The import path must end in `/client`. The datasource URL lives in
`prisma.config.ts`, not in the schema.

**Next.js 16 gotchas.** Dynamic route `params` is a Promise and must be awaited.
Middleware is called Proxy — the file is `proxy.ts` and the export is `proxy`;
a file named `middleware.ts` is silently ignored.
```

- [ ] **Step 3: Commit**

```bash
git add README.md PROGRESS.md
git commit -m "docs: add readme and progress handoff"
```

---

## Task 7: Final verification

- [ ] **Step 1: Clean install from scratch**

This catches anything that only works because of stale local state.

```bash
rm -rf node_modules .next app/generated
npm install
npx prisma migrate dev
npm run db:seed
```

Expected: all four complete without error. The seed reports 3 courses, 28 concepts, 29 relationships.

- [ ] **Step 2: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all four exit 0.

- [ ] **Step 3: Walk the product end to end in production mode**

Run `npm run start` and work through every surface, checking each item:

- [ ] `/` — landing renders without the sidebar, both themes, 375px wide
- [ ] `/register` — creates an account, lands on `/progress`
- [ ] `/explore` — three courses, category and difficulty filters change the URL and the results
- [ ] `/courses/generative-ai` — modules and topics with concept counts
- [ ] `/courses/generative-ai/map` — 11 nodes laid out left to right, click fills the panel
- [ ] `/learn/generative-ai/<topicId>` — real explanations per concept, chat answers a follow-up
- [ ] **Test yourself** — generates 5 questions, grades them, shows per-question feedback
- [ ] `/progress` — mastery reflects that assessment, recommendations have changed
- [ ] `/materials` — upload a text file, it reaches `ready`
- [ ] `/materials/<id>` — a covered question is answered with quoted passages; an uncovered one is declined
- [ ] `/courses/generative-ai/my-map` — build, save, compare; score and diff are accurate
- [ ] `/profile` — name, email, role, activity counts
- [ ] `/admin` — redirects unless the account is an admin
- [ ] Sign out — header switches to signed-out state, `/progress` redirects to `/login`
- [ ] A second account sees entirely separate data

- [ ] **Step 4: Check for leftover debugging**

```bash
grep -rn "console.log" --include="*.ts" --include="*.tsx" app components lib
```

Expected: no matches. `console.error` and `console.warn` in error paths are intentional and should stay.

- [ ] **Step 5: Confirm no secrets are tracked**

```bash
git ls-files | grep -E "^\.env$|\.env\.local$"
```

Expected: no output. Only `.env.example` should be tracked.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass"
```

---

## Phase 9 Exit Checklist

- [ ] `npm run build` succeeds from a clean `node_modules` and `.next`
- [ ] Every async route segment has a `loading.tsx`
- [ ] `app/error.tsx`, `app/not-found.tsx` and `app/global-error.tsx` all render correctly
- [ ] The landing page renders outside the shell and works at 375px in both themes
- [ ] A skip link is the first focusable element and works
- [ ] Every icon-only button has an `aria-label`
- [ ] Lighthouse reports no accessibility failures on `/explore` and `/progress`
- [ ] The full product flow works in production mode
- [ ] No `console.log` remains in `app/`, `components/` or `lib/`
- [ ] `.env` is not tracked
- [ ] `README.md` and `PROGRESS.md` are accurate

---

## Project Complete

All nine phases are done. The platform covers every vertical slice in the
source architecture document.

Deliberately out of scope for this build, and listed under **Next** in
`PROGRESS.md`: vector retrieval, diagnostic assessment on course start,
misconception tracking, session and progress logging, admin authoring, and
source management. Each is additive and none require restructuring what exists.
