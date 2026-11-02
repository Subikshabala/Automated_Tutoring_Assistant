# E2 — Curriculum Accordion

**Depends on:** nothing. **Blocks:** nothing. Small and independent.

**Problem:** the course page renders every module fully expanded. On `ai-agents` that is two module cards with all their topics visible at once; the page is a long undifferentiated list with no sense of where to start.

The user's screenshots show exactly this — module 01 and module 02 both dumped open, each listing every topic.

**Decision:** collapse modules into an accordion. The first opens by default; the rest are one click away. A learner sees the course shape before the detail.

---

## Task 1: Add the accordion primitive

- [ ] **Step 1: Install**

```bash
npx shadcn@latest add accordion --yes
```

- [ ] **Step 2: Confirm it landed**

```bash
ls components/ui/accordion.tsx
```

- [ ] **Step 3: Check the API**

base-nova wraps `@base-ui/react/accordion`, not Radix. Read the generated file and note the prop names — `openMultiple` rather than `type="single" | "multiple"`, and `defaultValue` takes an array.

```bash
grep -n "openMultiple\|defaultValue\|AccordionItem" components/ui/accordion.tsx | head
```

- [ ] **Step 4: Commit**

```bash
git add components/ui/accordion.tsx package.json package-lock.json
git commit -m "chore(ui): add accordion primitive"
```

---

## Task 2: Extract the curriculum

The course page is doing too much inline. Pull the curriculum into its own component so it is testable.

**File:** create `components/course-curriculum.tsx`, test `tests/components/course-curriculum.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CourseCurriculum } from '@/components/course-curriculum'
import type { ModuleSummary } from '@/lib/schemas/course'

const modules: ModuleSummary[] = [
  {
    id: 'm1',
    title: 'Agent Architecture',
    description: 'The loop, the tools, and the state.',
    order: 0,
    topics: [
      { id: 't1', title: 'The Agent Loop', description: 'Perceive, decide, act.', order: 0, conceptCount: 3 },
      { id: 't2', title: 'Planning and Control', description: 'Decomposing goals.', order: 1, conceptCount: 3 },
    ],
  },
  {
    id: 'm2',
    title: 'Multi-Agent Systems',
    description: 'When one agent is not the right shape.',
    order: 1,
    topics: [
      { id: 't3', title: 'Coordination', description: 'Splitting work.', order: 0, conceptCount: 2 },
    ],
  },
]

describe('CourseCurriculum', () => {
  it('renders every module title', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('Agent Architecture')).toBeInTheDocument()
    expect(screen.getByText('Multi-Agent Systems')).toBeInTheDocument()
  })

  it('numbers the modules', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
  })

  it('opens the first module by default', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('The Agent Loop')).toBeVisible()
  })

  it('leaves later modules collapsed', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.queryByText('Coordination')).not.toBeVisible()
  })

  it('expands a module on click', async () => {
    const u = userEvent.setup()
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    await u.click(screen.getByRole('button', { name: /Multi-Agent Systems/ }))
    expect(await screen.findByText('Coordination')).toBeVisible()
  })

  it('shows a topic count on the collapsed header', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('1 topic')).toBeInTheDocument()
    expect(screen.getByText('2 topics')).toBeInTheDocument()
  })

  it('shows a concept count per module header', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    // Module 1 has 3 + 3, module 2 has 2.
    expect(screen.getByText('6 concepts')).toBeInTheDocument()
    expect(screen.getByText('2 concepts')).toBeInTheDocument()
  })

  it('links each topic to its learn page', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByRole('link', { name: /The Agent Loop/ })).toHaveAttribute(
      'href',
      '/learn/ai-agents/t1',
    )
  })

  it('renders an empty state for a course with no modules', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={[]} />)
    expect(screen.getByText('No curriculum yet')).toBeInTheDocument()
  })

  it('keeps an open module open when another is opened', async () => {
    const u = userEvent.setup()
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    await u.click(screen.getByRole('button', { name: /Multi-Agent Systems/ }))
    expect(screen.getByText('The Agent Loop')).toBeVisible()
    expect(screen.getByText('Coordination')).toBeVisible()
  })
})
```

The last case is a deliberate decision: multiple modules may be open at once. A learner comparing two modules should not have one slam shut.

- [ ] **Step 2: Run it — expect module-not-found**

```bash
npx vitest run tests/components/course-curriculum.test.tsx --fileParallelism=false
```

- [ ] **Step 3: Build the component**

```tsx
'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { ModuleSummary } from '@/lib/schemas/course'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function CourseCurriculum({
  courseSlug,
  modules,
}: {
  courseSlug: string
  modules: ModuleSummary[]
}) {
  if (modules.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen data-icon />
          </EmptyMedia>
          <EmptyTitle>No curriculum yet</EmptyTitle>
          <EmptyDescription>
            This course has no modules. Check back later.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Accordion
      openMultiple
      defaultValue={[modules[0].id]}
      className="flex flex-col gap-3"
    >
      {modules.map((module, index) => {
        const conceptCount = module.topics.reduce(
          (sum, t) => sum + t.conceptCount,
          0,
        )

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            className="rounded-xl border bg-card px-5 transition-colors duration-200 hover:border-primary/30"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex flex-1 flex-col gap-1 text-left">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-base font-semibold">
                    {module.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="text-xs">
                    {plural(module.topics.length, 'topic')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {plural(conceptCount, 'concept')}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-4">
              <div className="flex flex-col gap-2">
                {module.topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/learn/${courseSlug}/${topic.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{topic.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {topic.description}
                      </span>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {plural(topic.conceptCount, 'concept')}
                    </Badge>
                  </Link>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
```

The counts on the trigger matter: a collapsed module must still tell you how much is inside, or collapsing has cost the learner information.

- [ ] **Step 4: Tests pass (10)**

If `openMultiple` is not the prop name, read `components/ui/accordion.tsx` and adjust. Base UI's accordion is multiple-open by default and takes `openMultiple={false}` to restrict it — check before assuming.

- [ ] **Step 5: Commit**

```bash
git add components/course-curriculum.tsx tests/components/course-curriculum.test.tsx
git commit -m "feat(ui): extract course curriculum into a collapsible accordion"
```

---

## Task 3: Use it on the course page

**File:** modify `app/courses/[slug]/page.tsx`

- [ ] **Step 1: Replace the inline block**

Delete the entire `<section>` that maps over `course.modules` rendering `Card` elements, and replace with:

```tsx
<section className="flex flex-col gap-4">
  <h2 className="text-lg font-semibold">Curriculum</h2>
  <CourseCurriculum courseSlug={course.slug} modules={course.modules} />
</section>
```

Add the import. Remove any now-unused imports — likely `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`. Check with:

```bash
npx eslint "app/courses/[slug]/page.tsx"
```

- [ ] **Step 2: Add a progress hint to the header**

A learner returning to a course should see where they are. If mastery data exists, show it.

```tsx
import { getSessionUser } from '@/lib/auth/session'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'

const user = await getSessionUser()
const mastery = user ? await listMasteryForCourse(user.id, slug) : []
const mastered = mastery.filter((m) => m.masteryScore >= MASTERED_THRESHOLD).length
```

Then in the stats row:

```tsx
{user && mastery.length > 0 && (
  <span className="flex items-center gap-1.5">
    <CircleCheck data-icon className="size-4" />
    {mastered} of {course.conceptCount} mastered
  </span>
)}
```

Import `CircleCheck`. Add `export const dynamic = 'force-dynamic'` — the page now reads cookies.

---

## Task 4: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Live check**

Open `/courses/ai-agents` — the screenshot case.

- [ ] Module 01 is open, module 02 collapsed
- [ ] Collapsed module 02 still shows `1 topic` and `2 concepts`
- [ ] Clicking module 02 expands it; module 01 stays open
- [ ] Topic rows link to the learn page
- [ ] The page is visibly shorter than before
- [ ] A signed-in learner with mastery sees the `N of M mastered` line

Then check `/courses/generative-ai`, which has four topics across two modules — the denser case.

- [ ] **Step 3: Keyboard**

Tab to a module header, press Enter. It should toggle. Tab into the expanded content and reach each topic link.

- [ ] **Step 4: Commit**

```bash
git add "app/courses/[slug]/page.tsx"
git commit -m "feat(ui): collapse curriculum modules behind an accordion

Every module rendered expanded, producing a long undifferentiated list.
The first module now opens by default and the rest collapse, with topic
and concept counts kept on the collapsed header so nothing is hidden
without a trace."
```

---

## Exit checklist

- [ ] First module open, rest collapsed
- [ ] Collapsed headers still show topic and concept counts
- [ ] Multiple modules can be open at once
- [ ] Topic links work
- [ ] Keyboard accessible
- [ ] Empty state for a course with no modules
- [ ] Mastery line appears for signed-in learners with progress
- [ ] All four verification commands pass

Part E complete. Next: [`F1-landing-progress-line.md`](./F1-landing-progress-line.md).
