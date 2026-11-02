# A3 — Fix the `/concept-map` 404

**Blocks:** nothing. Small and independent — do it alongside A1/A2.

**Symptom:** the sidebar has a **Concept Maps** item. Clicking it renders the 404 page inside the shell.

**Cause:** `components/nav-main.tsx:32` links to `/concept-map`. No such route exists. Concept maps live at `/courses/[slug]/map` (canonical) and `/courses/[slug]/my-map` (student-drawn), both reachable only from a course page.

**Decision:** build the route rather than delete the nav item. A learner with saved maps across several courses has nowhere to see them, and `listStudentMaps` already exists.

---

## Task 1: Repository support

`listStudentMaps(userId, courseSlug)` is course-scoped. The index needs every map.

**Files:** modify `lib/repositories/student-map.ts`, test `tests/repositories/student-map.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the existing describe block:

```ts
describe('listAllStudentMaps', () => {
  it('returns maps across every course', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    await saveStudentMap(user.id, {
      ...input,
      courseSlug: 'ai-agents',
      title: 'Agents attempt',
      nodes: [{ id: 'n1', label: 'Tool Calling', x: 0, y: 0 }],
      edges: [],
    })

    const maps = await listAllStudentMaps(user.id)
    expect(maps).toHaveLength(2)
    expect(maps.map((m) => m.courseSlug).sort()).toEqual([
      'ai-agents',
      'generative-ai',
    ])
  })

  it('includes the course title for display', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].courseTitle).toBe('Generative AI Foundations')
  })

  it('orders newest first', async () => {
    const user = await testUser()
    const first = await saveStudentMap(user.id, input)
    const second = await saveStudentMap(user.id, {
      ...input,
      title: 'Second',
    })
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].id).toBe(second.id)
    expect(maps[1].id).toBe(first.id)
  })

  it('returns an empty array for a learner with no maps', async () => {
    await expect(listAllStudentMaps('no-such-user')).resolves.toEqual([])
  })

  it('reports node and edge counts without loading them', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].nodeCount).toBe(2)
    expect(maps[0].edgeCount).toBe(1)
  })
})
```

Add `listAllStudentMaps` to the import.

- [ ] **Step 2: Implement in `lib/repositories/student-map.ts`**

A summary type, so the index does not pay for every node and edge.

```ts
export type StudentMapSummary = {
  id: string
  courseSlug: string
  courseTitle: string
  title: string
  nodeCount: number
  edgeCount: number
  updatedAt: string
}

export async function listAllStudentMaps(
  userId: string,
): Promise<StudentMapSummary[]> {
  const rows = await prisma.conceptMap.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      course: { select: { slug: true, title: true } },
      _count: { select: { nodes: true, edges: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    courseSlug: row.course.slug,
    courseTitle: row.course.title,
    title: row.title,
    nodeCount: row._count.nodes,
    edgeCount: row._count.edges,
    updatedAt: row.updatedAt.toISOString(),
  }))
}
```

- [ ] **Step 3: Tests pass (15), commit**

```bash
git add lib/repositories/student-map.ts tests/repositories/student-map.test.ts
git commit -m "feat(student-map): add cross-course map listing"
```

---

## Task 2: The index page

**Files:** create `app/concept-map/page.tsx`, `app/concept-map/loading.tsx`

- [ ] **Step 1: Loading skeleton**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: The page**

Two sections: the learner's saved maps, then every course's canonical map as an entry point.

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Network, PenLine } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { getSessionUser } from '@/lib/auth/session'
import { listAllStudentMaps } from '@/lib/repositories/student-map'
import { listCourses } from '@/lib/repositories/course'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Concept maps — Adaptive' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export default async function ConceptMapIndexPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=%2Fconcept-map')

  const [maps, courses] = await Promise.all([
    listAllStudentMaps(user.id),
    listCourses({}),
  ])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Concept maps</h1>
        <p className="text-sm text-muted-foreground">
          Study the canonical map for a course, or draw your own and compare.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your maps</h2>

        {maps.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PenLine data-icon />
              </EmptyMedia>
              <EmptyTitle>No maps yet</EmptyTitle>
              <EmptyDescription>
                Drawing your own map and comparing it against the course
                structure is the fastest way to find what you have misunderstood.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link href="/explore" />}
              >
                Pick a course
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => (
              <Link
                key={map.id}
                href={`/courses/${map.courseSlug}/my-map`}
                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base leading-snug">
                      {map.title}
                    </CardTitle>
                    <CardDescription>{map.courseTitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{map.nodeCount} concepts</Badge>
                    <Badge variant="secondary">{map.edgeCount} links</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDate(map.updatedAt)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Course maps</h2>
        <p className="text-sm text-muted-foreground">
          The canonical prerequisite graph for each course.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.slug}/map`}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">
                      {course.title}
                    </CardTitle>
                    <Network
                      data-icon
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </div>
                  <CardDescription>{course.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {course.conceptCount} concepts
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Protect the route**

In `proxy.ts`, add `/concept-map` to `PROTECTED_PREFIXES`:

```ts
const PROTECTED_PREFIXES = [
  '/progress',
  '/materials',
  '/profile',
  '/admin',
  '/assessment',
  '/learn',
  '/concept-map',
]
```

- [ ] **Step 4: Check the nav highlight**

`nav-main.tsx` marks an item active with `pathname === item.href || pathname.startsWith(item.href + '/')`. `/concept-map` now matches exactly. No change needed.

Note `/courses/[slug]/map` will **not** highlight the nav item — it lives under `/courses`. That is correct; it is reached from a course, not from the nav.

---

## Task 3: Verify and commit

- [ ] **Step 1: Full gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Live check**

```bash
npm run dev
```

With no saved maps: **Concept Maps** in the sidebar renders the empty state plus three course cards.

Then draw and save a map at `/courses/generative-ai/my-map`, return to `/concept-map`, and confirm it appears with correct counts and date.

Signed out, `/concept-map` should redirect to `/login?next=%2Fconcept-map`.

- [ ] **Step 3: Commit**

```bash
git add app/concept-map lib/repositories/student-map.ts tests/repositories/student-map.test.ts proxy.ts
git commit -m "feat(maps): add /concept-map index page

The sidebar linked to a route that was never built. Adds an index listing
the learner's saved maps across all courses plus an entry point to each
canonical course map, backed by a new listAllStudentMaps repository query."
```

---

## Exit checklist

- [ ] **Concept Maps** in the sidebar no longer 404s
- [ ] Empty state shows when the learner has no maps
- [ ] Saved maps appear with correct node/edge counts and date
- [ ] All three course maps are reachable from the index
- [ ] Signed out redirects to login with a `next` param
- [ ] 570 tests pass (565 from A2 + 5 here)
