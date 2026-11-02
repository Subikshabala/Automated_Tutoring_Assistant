# G4 — Make Admin Real

**Depends on:** G2, G3. **Blocks:** nothing.

**Problem:** `/admin` shows four counters and a read-only course list. It answers no question an admin would actually ask.

The user asked *"what is the admin one?"* — which is the honest reaction to a page that does nothing.

Meanwhile the `Source` table exists and nothing writes to it:

```prisma
model Source {
  id              String       @id @default(cuid())
  courseId        String?
  topicId         String?
  title           String
  url             String?
  publisher       String?
  authorityLevel  Int          @default(4)   // Tier 1-4
  publicationDate DateTime?
  version         String?
  status          SourceStatus @default(DRAFT)
  lastVerifiedAt  DateTime?
}
```

The architecture document specifies a source approval workflow: Draft → Ingested → Processed → In Review → Approved → Published → Archived. None of it was built.

**Decision:** two things an admin genuinely needs. A learner overview showing who is stuck, and source management so course claims can be attributed.

---

## Task 1: Learner overview

**File:** create `lib/repositories/admin.ts`, test `tests/repositories/admin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { listLearnerOverview, getPlatformStats } from '@/lib/repositories/admin'
import { recordAttempt } from '@/lib/repositories/mastery'

async function learner(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: 'x', name: email.split('@')[0] },
    update: {},
  })
}
async function conceptId(name: string) {
  const c = await prisma.concept.findFirstOrThrow({ where: { name } })
  return c.id
}

afterEach(async () => {
  await prisma.mastery.deleteMany({
    where: { user: { email: { contains: 'admin-test' } } },
  })
  await prisma.user.deleteMany({
    where: { email: { contains: 'admin-test' } },
  })
})

describe('listLearnerOverview', () => {
  it('returns every learner', async () => {
    await learner('admin-test-a@example.com')
    await learner('admin-test-b@example.com')
    const rows = await listLearnerOverview()
    const emails = rows.map((r) => r.email)
    expect(emails).toContain('admin-test-a@example.com')
    expect(emails).toContain('admin-test-b@example.com')
  })

  it('reports zero activity for a new account', async () => {
    const u = await learner('admin-test-new@example.com')
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsStarted).toBe(0)
    expect(row!.conceptsMastered).toBe(0)
  })

  it('counts started concepts', async () => {
    const u = await learner('admin-test-active@example.com')
    await recordAttempt(u.id, await conceptId('Tokenization'), 0.6)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsStarted).toBe(1)
  })

  it('counts mastered separately from started', async () => {
    const u = await learner('admin-test-master@example.com')
    const id = await conceptId('Tokenization')
    await recordAttempt(u.id, id, 1)
    await recordAttempt(u.id, id, 1)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.conceptsMastered).toBe(1)
  })

  it('flags a learner who is struggling', async () => {
    const u = await learner('admin-test-stuck@example.com')
    await recordAttempt(u.id, await conceptId('Tokenization'), 0)
    await recordAttempt(u.id, await conceptId('Embeddings'), 0)
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.needsReview).toBeGreaterThanOrEqual(2)
  })

  it('reports the role', async () => {
    const u = await learner('admin-test-role@example.com')
    const row = (await listLearnerOverview()).find((r) => r.id === u.id)
    expect(row!.role).toBe('USER')
  })

  it('never exposes the password hash', async () => {
    await learner('admin-test-safe@example.com')
    const rows = await listLearnerOverview()
    expect(rows[0]).not.toHaveProperty('passwordHash')
  })

  it('orders most recently active first', async () => {
    const quiet = await learner('admin-test-quiet@example.com')
    const busy = await learner('admin-test-busy@example.com')
    await recordAttempt(busy.id, await conceptId('Tokenization'), 0.5)
    const rows = await listLearnerOverview()
    const busyIndex = rows.findIndex((r) => r.id === busy.id)
    const quietIndex = rows.findIndex((r) => r.id === quiet.id)
    expect(busyIndex).toBeLessThan(quietIndex)
  })
})

describe('getPlatformStats', () => {
  it('returns the headline counters', async () => {
    const stats = await getPlatformStats()
    expect(stats.courses).toBeGreaterThan(0)
    expect(typeof stats.learners).toBe('number')
    expect(typeof stats.assessmentsTaken).toBe('number')
    expect(typeof stats.materialsUploaded).toBe('number')
  })

  it('reports concepts with no mastery data anywhere', async () => {
    const stats = await getPlatformStats()
    expect(typeof stats.untouchedConcepts).toBe('number')
  })

  it('reports open misconceptions across the platform', async () => {
    const stats = await getPlatformStats()
    expect(typeof stats.openMisconceptions).toBe('number')
  })
})
```

- [ ] **Step 2: Implement**

```ts
import prisma from '@/lib/prisma'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'
import type { Role } from '@/lib/schemas/auth'

export type LearnerRow = {
  id: string
  name: string
  email: string
  role: Role
  conceptsStarted: number
  conceptsMastered: number
  needsReview: number
  openMisconceptions: number
  lastActiveAt: Date | null
  joinedAt: Date
}

export async function listLearnerOverview(): Promise<LearnerRow[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      mastery: {
        select: { masteryScore: true, status: true, lastInteractionAt: true },
      },
      _count: { select: { materials: true } },
    },
  })

  const misconceptionCounts = await prisma.misconception.groupBy({
    by: ['userId'],
    where: { resolved: false },
    _count: true,
  })
  const misconceptionsByUser = new Map(
    misconceptionCounts.map((m) => [m.userId, m._count]),
  )

  const rows: LearnerRow[] = users.map((user) => {
    const lastActive = user.mastery.reduce<Date | null>(
      (latest, m) =>
        !latest || m.lastInteractionAt > latest ? m.lastInteractionAt : latest,
      null,
    )

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      conceptsStarted: user.mastery.length,
      conceptsMastered: user.mastery.filter(
        (m) => m.masteryScore >= MASTERED_THRESHOLD,
      ).length,
      needsReview: user.mastery.filter((m) => m.status === 'NEEDS_REVIEW').length,
      openMisconceptions: misconceptionsByUser.get(user.id) ?? 0,
      lastActiveAt: lastActive,
      joinedAt: user.createdAt,
    }
  })

  // Active learners first; never-active fall to the bottom by join date.
  return rows.sort((a, b) => {
    if (a.lastActiveAt && b.lastActiveAt) {
      return b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
    }
    if (a.lastActiveAt) return -1
    if (b.lastActiveAt) return 1
    return b.joinedAt.getTime() - a.joinedAt.getTime()
  })
}

export type PlatformStats = {
  courses: number
  learners: number
  assessmentsTaken: number
  materialsUploaded: number
  /** Concepts no learner has attempted — likely unreachable or unattractive. */
  untouchedConcepts: number
  openMisconceptions: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    courses,
    learners,
    assessmentsTaken,
    materialsUploaded,
    totalConcepts,
    touched,
    openMisconceptions,
  ] = await Promise.all([
    prisma.course.count({ where: { published: true } }),
    prisma.user.count(),
    prisma.assessment.count({ where: { submittedAt: { not: null } } }),
    prisma.material.count(),
    prisma.concept.count(),
    prisma.mastery.findMany({ select: { conceptId: true }, distinct: ['conceptId'] }),
    prisma.misconception.count({ where: { resolved: false } }),
  ])

  return {
    courses,
    learners,
    assessmentsTaken,
    materialsUploaded,
    untouchedConcepts: totalConcepts - touched.length,
    openMisconceptions,
  }
}
```

`untouchedConcepts` is the genuinely useful number. A concept nobody has ever attempted is either unreachable in the prerequisite graph or nobody wants it — both worth knowing.

- [ ] **Step 3: Tests pass (11), commit**

```bash
git add lib/repositories/admin.ts tests/repositories/admin.test.ts
git commit -m "feat(admin): add learner overview and platform stats queries"
```

---

## Task 2: Source management

**Files:** `lib/schemas/source.ts`, `lib/repositories/source.ts`, `app/api/admin/sources/route.ts`

- [ ] **Step 1: Schema**

```ts
import { z } from 'zod'
import { idSchema } from './common'

export const sourceStatusSchema = z.enum([
  'DRAFT',
  'INGESTED',
  'PROCESSED',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
])

/**
 * Tier 1 is a primary specification or peer-reviewed paper.
 * Tier 4 is a blog post or forum answer.
 */
export const authorityLevelSchema = z.number().int().min(1).max(4)

export const createSourceSchema = z.object({
  courseId: idSchema.nullable().optional(),
  topicId: idSchema.nullable().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url().nullable().optional(),
  publisher: z.string().max(120).nullable().optional(),
  authorityLevel: authorityLevelSchema.default(4),
  publicationDate: z.string().datetime().nullable().optional(),
  version: z.string().max(40).nullable().optional(),
})

export const updateSourceStatusSchema = z.object({
  status: sourceStatusSchema,
})
```

- [ ] **Step 2: Enforce the workflow**

Status must not jump arbitrarily. Draft cannot become Published without review.

```ts
const ALLOWED_TRANSITIONS: Record<SourceStatus, SourceStatus[]> = {
  DRAFT: ['INGESTED', 'ARCHIVED'],
  INGESTED: ['PROCESSED', 'ARCHIVED'],
  PROCESSED: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'PROCESSED', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'IN_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'IN_REVIEW'],
  ARCHIVED: ['DRAFT'],
}

export function canTransition(from: SourceStatus, to: SourceStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

Test every legal transition and a representative illegal one — `DRAFT → PUBLISHED` must be rejected.

- [ ] **Step 3: Endpoints**

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/sources` | List, filterable by course and status |
| `POST` | `/api/admin/sources` | Create in `DRAFT` |
| `PATCH` | `/api/admin/sources/[id]` | Transition status, validated |
| `DELETE` | `/api/admin/sources/[id]` | Remove a draft only |

Every one calls `requireAdmin()` first.

---

## Task 3: Rebuild the page

**File:** rewrite `app/admin/page.tsx`

Three tabs, so a 20-row learner table does not bury the stats.

- [ ] **Step 1: Stats row**

Keep the four counters, add the two new ones. Make `untouchedConcepts` and `openMisconceptions` visually distinct — they are the actionable numbers, not vanity metrics.

- [ ] **Step 2: Learners tab**

A table: name, email, role badge, started, mastered, needs review, open misconceptions, last active.

Highlight rows where `needsReview >= 3` or `openMisconceptions >= 2` with a muted warning background. That is the admin's actual job — spotting who is stuck.

- [ ] **Step 3: Sources tab**

List with status badges and a tier indicator. A **New source** dialog using `Field` + `FieldGroup`. Status changes through a dropdown offering only legal transitions.

- [ ] **Step 4: Content tab**

The existing course list, plus per-course concept coverage — how many of its concepts anyone has attempted.

---

## Task 4: Harden authorisation

Every admin endpoint must independently verify. The proxy redirect is a convenience, not a boundary.

- [ ] **Step 1: Audit**

```bash
grep -rLn "requireAdmin" app/api/admin --include="*.ts"
```

Any file listed is unguarded. Fix it.

- [ ] **Step 2: Test the guard on every route**

For each admin endpoint, three cases: ADMIN succeeds, USER gets 403, signed out gets 401. Also assert the repository is never called when authorisation fails — a guard that runs after the query has already leaked the data.

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

```bash
npx tsx scripts/make-admin.ts your@email.com
```

Sign out and back in — the role is in the JWT.

- [ ] `/admin` shows six stats including untouched concepts
- [ ] Learners tab lists accounts with real activity figures
- [ ] A struggling learner's row is visibly flagged
- [ ] Sources tab allows creating a draft
- [ ] Status dropdown offers only legal next steps
- [ ] `DRAFT → PUBLISHED` is not offered
- [ ] Signing in as a non-admin and visiting `/admin` redirects
- [ ] `curl` to an admin API as a non-admin returns 403

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): add learner overview and source management

The admin page showed four counters and a read-only course list. It now
surfaces who is struggling, which concepts nobody reaches, and a source
approval workflow backed by the Source table that previously had no writer."
```

---

## Exit checklist

- [ ] Learner overview shows real per-account activity
- [ ] Struggling learners are visually flagged
- [ ] Untouched concepts are reported
- [ ] Sources can be created and transitioned
- [ ] Illegal transitions are rejected server-side, not just hidden in the UI
- [ ] Every admin endpoint calls `requireAdmin` before touching data
- [ ] Non-admins get 403 from the API, not just a redirect
- [ ] No password hash reaches any response
- [ ] All four verification commands pass

Next: [`G5-demo-walkthrough.md`](./G5-demo-walkthrough.md) — the last one.
