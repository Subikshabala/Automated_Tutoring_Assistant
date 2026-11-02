# G2 — Session Tracking

**Depends on:** A1. **Blocks:** G3, G5.

**Problem:** two tables exist and nothing writes to them. Verified by grepping every call site — only the generated Prisma client mentions them.

| Table | Fields | Writes |
|---|---|---|
| `LearningSession` | userId, courseId, topicId, startedAt, endedAt | **none** |
| `LearningProgress` | userId, conceptId, completed, timeSpentSec, lastViewedAt | **none** |

Consequences the user can see:

- Profile shows `0 concepts started` even after reading several
- Progress counts mastery only, so reading without assessing registers as nothing
- No notion of "continue where you left off"
- The adaptive engine cannot distinguish *never seen* from *seen and still weak* — both are score 0

**Decision:** record a session when a topic is opened, record per-concept view time, and surface both. Keep it cheap — a heartbeat, not analytics.

---

## Task 1: Progress repository

**File:** create `lib/repositories/learning.ts`, test `tests/repositories/learning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  endSession,
  getConceptProgress,
  getResumePoint,
  recordConceptView,
  startSession,
} from '@/lib/repositories/learning'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'learning-test@example.com' },
    create: { email: 'learning-test@example.com', passwordHash: 'x', name: 'T' },
    update: {},
  })
}
async function firstTopic() {
  return prisma.topic.findFirstOrThrow({ where: { title: 'Text Representation' } })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.learningSession.deleteMany({ where: { userId: user.id } })
  await prisma.learningProgress.deleteMany({ where: { userId: user.id } })
})

describe('startSession', () => {
  it('creates an open session', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    expect(session.endedAt).toBeNull()
  })

  it('reuses an open session for the same topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const first = await startSession(user.id, topic.id)
    const second = await startSession(user.id, topic.id)
    expect(second.id).toBe(first.id)
  })

  it('closes a stale session on a different topic', async () => {
    const user = await testUser()
    const topics = await prisma.topic.findMany({ take: 2 })
    await startSession(user.id, topics[0].id)
    await startSession(user.id, topics[1].id)
    const open = await prisma.learningSession.findMany({
      where: { userId: user.id, endedAt: null },
    })
    expect(open).toHaveLength(1)
  })

  it('resolves the course from the topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    expect(session.courseId).toBeTruthy()
  })
})

describe('endSession', () => {
  it('stamps endedAt', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    await endSession(session.id)
    const row = await prisma.learningSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(row.endedAt).not.toBeNull()
  })

  it('is safe to call twice', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    const session = await startSession(user.id, topic.id)
    await endSession(session.id)
    await expect(endSession(session.id)).resolves.not.toThrow()
  })

  it('ignores an unknown id', async () => {
    await expect(endSession('nope')).resolves.not.toThrow()
  })
})

describe('recordConceptView', () => {
  it('creates a progress row on first view', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 30)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(30)
  })

  it('accumulates time across views', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 30)
    await recordConceptView(user.id, id, 45)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(75)
  })

  it('marks completed past the threshold', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 120)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.completed).toBe(true)
  })

  it('leaves a brief view incomplete', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 5)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.completed).toBe(false)
  })

  it('refreshes lastViewedAt', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 10)
    const first = (await getConceptProgress(user.id, id))!.lastViewedAt
    await new Promise((r) => setTimeout(r, 20))
    await recordConceptView(user.id, id, 10)
    const second = (await getConceptProgress(user.id, id))!.lastViewedAt
    expect(second.getTime()).toBeGreaterThan(first.getTime())
  })

  it('rejects a negative duration', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, -50)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBe(0)
  })

  it('caps an implausible single view', async () => {
    const user = await testUser()
    const id = await conceptId('Tokenization')
    await recordConceptView(user.id, id, 100_000)
    const progress = await getConceptProgress(user.id, id)
    expect(progress!.timeSpentSec).toBeLessThanOrEqual(3600)
  })
})

describe('getResumePoint', () => {
  it('returns null for a learner with no history', async () => {
    const user = await testUser()
    await expect(getResumePoint(user.id)).resolves.toBeNull()
  })

  it('returns the most recent topic', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    await startSession(user.id, topic.id)
    const resume = await getResumePoint(user.id)
    expect(resume!.topicId).toBe(topic.id)
  })

  it('includes the course slug for linking', async () => {
    const user = await testUser()
    const topic = await firstTopic()
    await startSession(user.id, topic.id)
    const resume = await getResumePoint(user.id)
    expect(resume!.courseSlug).toBe('generative-ai')
  })
})
```

- [ ] **Step 2: Implement**

```ts
import prisma from '@/lib/prisma'

/** Treat a concept as read after this long. */
const COMPLETION_SECONDS = 60

/** Ignore a single heartbeat claiming more than an hour — a stale tab. */
const MAX_SINGLE_VIEW_SECONDS = 3600

export async function startSession(userId: string, topicId: string) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: { module: { select: { courseId: true } } },
  })

  const existing = await prisma.learningSession.findFirst({
    where: { userId, topicId, endedAt: null },
  })
  if (existing) return existing

  // Only one session open at a time — close anything left dangling.
  await prisma.learningSession.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  })

  return prisma.learningSession.create({
    data: { userId, topicId, courseId: topic.module.courseId },
  })
}

export async function endSession(sessionId: string): Promise<void> {
  // updateMany rather than update: no throw when the id is unknown or
  // the session was already closed by a navigation race.
  await prisma.learningSession.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: new Date() },
  })
}

export async function recordConceptView(
  userId: string,
  conceptId: string,
  seconds: number,
): Promise<void> {
  const delta = Math.min(MAX_SINGLE_VIEW_SECONDS, Math.max(0, Math.round(seconds)))

  const existing = await prisma.learningProgress.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })

  const total = (existing?.timeSpentSec ?? 0) + delta

  await prisma.learningProgress.upsert({
    where: { userId_conceptId: { userId, conceptId } },
    create: {
      userId,
      conceptId,
      timeSpentSec: delta,
      completed: delta >= COMPLETION_SECONDS,
      lastViewedAt: new Date(),
    },
    update: {
      timeSpentSec: total,
      completed: total >= COMPLETION_SECONDS,
      lastViewedAt: new Date(),
    },
  })
}

export async function getConceptProgress(userId: string, conceptId: string) {
  return prisma.learningProgress.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })
}

export type ResumePoint = {
  topicId: string
  topicTitle: string
  courseSlug: string
  courseTitle: string
  lastSeenAt: Date
}

export async function getResumePoint(
  userId: string,
): Promise<ResumePoint | null> {
  const session = await prisma.learningSession.findFirst({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { slug: true, title: true } } } },
        },
      },
    },
  })

  if (!session?.topic) return null

  return {
    topicId: session.topic.id,
    topicTitle: session.topic.title,
    courseSlug: session.topic.module.course.slug,
    courseTitle: session.topic.module.course.title,
    lastSeenAt: session.startedAt,
  }
}

export async function countStartedConcepts(userId: string): Promise<number> {
  return prisma.learningProgress.count({ where: { userId } })
}
```

- [ ] **Step 3: Tests pass (17), commit**

```bash
git add lib/repositories/learning.ts tests/repositories/learning.test.ts
git commit -m "feat(progress): add session and concept-view tracking"
```

---

## Task 2: Heartbeat endpoint

**File:** create `app/api/learning/heartbeat/route.ts`

One endpoint, called periodically by the learn page.

- [ ] **Step 1: Build it**

```ts
import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { idSchema } from '@/lib/schemas/common'
import { recordConceptView, startSession } from '@/lib/repositories/learning'

const bodySchema = z.object({
  topicId: idSchema,
  conceptId: idSchema,
  /** Seconds since the last heartbeat. */
  seconds: z.number().int().min(0).max(300),
})

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    const { topicId, conceptId, seconds } = await parseJson(request, bodySchema)

    await startSession(user.id, topicId)
    if (seconds > 0) {
      await recordConceptView(user.id, conceptId, seconds)
    }

    return ok({ recorded: true })
  })
}
```

Capping at 300 means a tab left open overnight cannot claim eight hours of study.

- [ ] **Step 2: Test it**

`tests/api/heartbeat.test.ts` — mock `requireUser`, `startSession`, `recordConceptView`. Cover: records a view, skips the view at 0 seconds but still starts the session, rejects >300, rejects a missing conceptId, 401 unauthenticated.

---

## Task 3: Client heartbeat

**File:** create `hooks/use-learning-heartbeat.ts`

- [ ] **Step 1: Build it**

```ts
'use client'

import { useEffect, useRef } from 'react'

const INTERVAL_MS = 30_000

/**
 * Reports time spent on the active concept.
 *
 * Pauses when the tab is hidden, and flushes on unmount so switching
 * concepts does not lose the trailing partial interval.
 */
export function useLearningHeartbeat(topicId: string, conceptId: string) {
  const accumulated = useRef(0)
  const lastTick = useRef(Date.now())

  useEffect(() => {
    accumulated.current = 0
    lastTick.current = Date.now()

    const send = (seconds: number) => {
      if (seconds <= 0) return
      void fetch('/api/learning/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, conceptId, seconds }),
        keepalive: true,
      }).catch(() => {
        // Tracking is best-effort. Never surface a failure to the learner.
      })
    }

    const tick = () => {
      if (document.hidden) {
        // Discard the elapsed window — the learner was not looking.
        lastTick.current = Date.now()
        return
      }
      const elapsed = Math.round((Date.now() - lastTick.current) / 1000)
      lastTick.current = Date.now()
      accumulated.current += elapsed
      send(elapsed)
    }

    const timer = setInterval(tick, INTERVAL_MS)

    return () => {
      clearInterval(timer)
      // Flush the partial interval on concept change or unmount.
      const elapsed = Math.round((Date.now() - lastTick.current) / 1000)
      if (!document.hidden) send(elapsed)
    }
  }, [topicId, conceptId])
}
```

`keepalive: true` lets the final flush survive a page navigation.

- [ ] **Step 2: Use it in `LearnView`**

```tsx
import { useLearningHeartbeat } from '@/hooks/use-learning-heartbeat'

useLearningHeartbeat(topic.id, activeId)
```

The hook re-runs on `activeId` change, so switching concepts flushes the old one and starts the new.

---

## Task 4: Surface it

Tracking nobody sees is not worth the writes.

- [ ] **Step 1: Profile activity**

`app/profile/page.tsx` computes `started` from mastery. Use real view data:

```tsx
import { countStartedConcepts } from '@/lib/repositories/learning'

const [progress, viewedCount] = await Promise.all([
  getAllCourseProgress(user.id),
  countStartedConcepts(user.id),
])
```

Show `viewedCount` for `concepts started`, keep mastery for `concepts mastered`. These are genuinely different numbers and both are informative.

- [ ] **Step 2: Resume card on Progress**

At the top of `app/progress/page.tsx`:

```tsx
const resume = await getResumePoint(user.id)
```

```tsx
{resume && (
  <Card>
    <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Continue where you left off
        </span>
        <span className="font-medium">{resume.topicTitle}</span>
        <span className="text-sm text-muted-foreground">
          {resume.courseTitle}
        </span>
      </div>
      <Button
        nativeButton={false}
        render={
          <Link href={`/learn/${resume.courseSlug}/${resume.topicId}`} />
        }
      >
        Resume
        <ArrowRight data-icon />
      </Button>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Viewed marker on concept chips**

In `LearnView`, a concept already read should look different from an untouched one. Pass a `viewedConceptIds` set from the page and add a subtle `CircleCheck` to those chips.

---

## Task 5: Verify

- [ ] **Step 1: Gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 2: Live check**

Open a learn page and leave it for ~90 seconds, switching concepts once.

```bash
npx prisma db execute --stdin <<< "SELECT conceptId, timeSpentSec, completed FROM LearningProgress;"
npx prisma db execute --stdin <<< "SELECT topicId, startedAt, endedAt FROM LearningSession;"
```

- [ ] A `LearningSession` row exists with `endedAt` null while open
- [ ] `LearningProgress` rows accumulate seconds
- [ ] A concept past 60s is `completed = 1`
- [ ] Switching concepts flushes the previous one
- [ ] Backgrounding the tab stops accumulation
- [ ] Profile shows a non-zero `concepts started`
- [ ] Progress shows the resume card
- [ ] Resume navigates back to the topic

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(progress): record learning sessions and concept view time

LearningSession and LearningProgress existed in the schema with no writer,
so Profile reported zero concepts started however long a learner read. A
30s heartbeat now records per-concept time, pausing on a hidden tab and
flushing on concept change, and Progress gains a resume card."
```

---

## Exit checklist

- [ ] Sessions open on topic view, close on navigation
- [ ] Only one session open per learner at a time
- [ ] View time accumulates per concept
- [ ] Hidden tabs do not accumulate
- [ ] Single-heartbeat time is capped
- [ ] Profile reports real started counts
- [ ] Resume card appears and works
- [ ] All four verification commands pass

Next: [`G3-misconceptions.md`](./G3-misconceptions.md).
