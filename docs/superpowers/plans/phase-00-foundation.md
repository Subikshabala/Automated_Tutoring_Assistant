# Phase 0 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Establish the database, the shared type contracts, the test harness, and the application shell so that every later phase can be a pure vertical slice.

**Architecture:** Prisma 7 + SQLite behind a `globalThis`-cached singleton. A small `lib/api.ts` response envelope used by all Route Handlers. Zod schemas in `lib/schemas/` as the single source of truth for both runtime validation and TypeScript types. Vitest for unit/integration tests. A persistent sidebar shell built from shadcn/ui.

**Tech Stack:** Prisma 7 · SQLite · Zod · Vitest · TanStack Query · shadcn/ui (base-nova)

**Depends on:** nothing. This is the first phase.

**Done when:** `npm run typecheck`, `npm run lint`, and `npm test` all pass; `npx prisma studio` shows 19 empty tables; `npm run dev` renders the app shell with working sidebar navigation and a theme toggle.

---

## File Structure

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | All 19 models, enums, relations |
| `prisma.config.ts` | Prisma 7 datasource + migration config |
| `lib/prisma.ts` | Prisma Client singleton |
| `lib/api.ts` | `ok()` / `fail()` response envelope + `ApiError` |
| `lib/schemas/common.ts` | Shared primitives: ids, pagination, enums |
| `lib/schemas/course.ts` | Course / Module / Topic contracts |
| `lib/schemas/concept.ts` | Concept / ConceptRelationship contracts |
| `lib/query-provider.tsx` | TanStack Query client provider |
| `components/app-shell.tsx` | Sidebar + header layout wrapper |
| `components/nav-main.tsx` | Sidebar navigation items |
| `components/mode-toggle.tsx` | Light/dark theme switch |
| `app/layout.tsx` | Root layout — wires providers + shell |
| `tests/setup.ts` | Vitest global setup |
| `vitest.config.ts` | Vitest configuration |
| `.env.example` | Documented env var template |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @prisma/client@^7 zod @tanstack/react-query @xyflow/react @google/genai jose bcryptjs
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D prisma@^7 vitest @vitejs/plugin-react vite-tsconfig-paths @testing-library/react @testing-library/jest-dom jsdom @types/bcryptjs tsx
```

- [ ] **Step 3: Add test scripts to `package.json`**

Add these three entries to the `"scripts"` object, keeping the existing ones:

```json
"test": "vitest run",
"test:watch": "vitest",
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 4: Verify install**

Run: `npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add prisma, zod, query, flow, gemini, auth and test deps"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sanity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `vitest.config.ts` does not exist, or "No test files found" / config error.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test`
Expected: PASS — `1 passed (1)`.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts tests/sanity.test.ts
git commit -m "test: add vitest harness with jsdom and path aliases"
```

---

## Task 3: Environment variables

**Files:**
- Create: `.env.example`
- Create: `.env`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

```bash
# SQLite database file. Relative paths resolve from the prisma/ directory.
DATABASE_URL="file:./dev.db"

# Google Gemini API key. SERVER-SIDE ONLY — never prefix with NEXT_PUBLIC_.
# Get one at https://aistudio.google.com/apikey
GEMINI_API_KEY=""

# Gemini model id used for all generation calls.
GEMINI_MODEL="gemini-2.0-flash"

# Secret for signing session JWTs. Generate with: openssl rand -base64 32
JWT_SECRET=""
```

- [ ] **Step 2: Create your real `.env`**

```bash
cp .env.example .env
```

Then open `.env` and fill in `GEMINI_API_KEY` with a real key, and set `JWT_SECRET`:

```bash
echo "JWT_SECRET=\"$(openssl rand -base64 32)\"" >> .env
```

Remove the empty `JWT_SECRET=""` line that `cp` brought over so the key is not defined twice.

- [ ] **Step 3: Confirm `.env` is ignored**

Run: `git check-ignore -v .env`
Expected: a line naming `.gitignore` and the matching pattern. If the command exits non-zero, append `.env` to `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: document required environment variables"
```

---

## Task 4: Prisma schema — core hierarchy

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`

- [ ] **Step 1: Create `prisma.config.ts`**

Prisma 7 moved the datasource URL out of the schema into this file.

```ts
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 2: Create `prisma/schema.prisma` with generator, datasource and enums**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum Role {
  USER
  ADMIN
}

enum MasteryStatus {
  NOT_STARTED
  LEARNING
  PRACTICING
  MASTERED
  NEEDS_REVIEW
}

enum RelationshipType {
  PREREQUISITE_OF
  RELATED_TO
  PART_OF
  LEADS_TO
}

enum QuestionType {
  MCQ
  SHORT_ANSWER
  SCENARIO
}

enum Difficulty {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum SourceStatus {
  DRAFT
  INGESTED
  PROCESSED
  IN_REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

enum MaterialStatus {
  UPLOADED
  PROCESSING
  READY
  FAILED
}
```

- [ ] **Step 3: Append the user and course hierarchy models**

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions    LearningSession[]
  progress    LearningProgress[]
  mastery     Mastery[]
  assessments Assessment[]
  materials   Material[]
  conceptMaps ConceptMap[]
}

model Course {
  id          String     @id @default(cuid())
  slug        String     @unique
  title       String
  description String
  category    String
  difficulty  Difficulty @default(BEGINNER)
  estimatedHours Int     @default(0)
  published   Boolean    @default(false)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  modules     Module[]
  concepts    Concept[]
  sources     Source[]
  sessions    LearningSession[]
  conceptMaps ConceptMap[]

  @@index([category])
}

model Module {
  id          String   @id @default(cuid())
  courseId    String
  title       String
  description String
  order       Int
  createdAt   DateTime @default(now())

  course   Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  topics   Topic[]
  concepts Concept[]

  @@unique([courseId, order])
  @@index([courseId])
}

model Topic {
  id          String   @id @default(cuid())
  moduleId    String
  title       String
  description String
  order       Int
  createdAt   DateTime @default(now())

  module   Module    @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  concepts Concept[]
  sources  Source[]
  sessions LearningSession[]

  @@unique([moduleId, order])
  @@index([moduleId])
}
```

- [ ] **Step 4: Append the concept models**

`objectives` and `keyPoints` are JSON-encoded string arrays because SQLite has no native array type. Always read them through the helpers added in Task 7.

```prisma
model Concept {
  id          String     @id @default(cuid())
  courseId    String
  moduleId    String?
  topicId     String?
  name        String
  definition  String
  difficulty  Difficulty @default(BEGINNER)
  objectives  String     @default("[]")
  order       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  course Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  module Module? @relation(fields: [moduleId], references: [id], onDelete: SetNull)
  topic  Topic?  @relation(fields: [topicId], references: [id], onDelete: SetNull)

  outgoing      ConceptRelationship[] @relation("FromConcept")
  incoming      ConceptRelationship[] @relation("ToConcept")
  mastery       Mastery[]
  misconceptions Misconception[]
  questions     Question[]
  progress      LearningProgress[]
  mapNodes      ConceptMapNode[]

  @@index([courseId])
  @@index([topicId])
}

model ConceptRelationship {
  id        String           @id @default(cuid())
  fromId    String
  toId      String
  type      RelationshipType
  strength  Float            @default(1.0)
  createdAt DateTime         @default(now())

  from Concept @relation("FromConcept", fields: [fromId], references: [id], onDelete: Cascade)
  to   Concept @relation("ToConcept", fields: [toId], references: [id], onDelete: Cascade)

  @@unique([fromId, toId, type])
  @@index([fromId])
  @@index([toId])
}
```

- [ ] **Step 5: Append the learning, mastery and assessment models**

```prisma
model Source {
  id              String       @id @default(cuid())
  courseId        String?
  topicId         String?
  title           String
  url             String?
  publisher       String?
  authorityLevel  Int          @default(4)
  publicationDate DateTime?
  version         String?
  status          SourceStatus @default(DRAFT)
  lastVerifiedAt  DateTime?
  createdAt       DateTime     @default(now())

  course Course? @relation(fields: [courseId], references: [id], onDelete: SetNull)
  topic  Topic?  @relation(fields: [topicId], references: [id], onDelete: SetNull)

  @@index([courseId])
}

model LearningSession {
  id        String    @id @default(cuid())
  userId    String
  courseId  String
  topicId   String?
  startedAt DateTime  @default(now())
  endedAt   DateTime?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  topic  Topic? @relation(fields: [topicId], references: [id], onDelete: SetNull)

  @@index([userId, courseId])
}

model LearningProgress {
  id          String   @id @default(cuid())
  userId      String
  conceptId   String
  completed   Boolean  @default(false)
  timeSpentSec Int     @default(0)
  lastViewedAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  concept Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@unique([userId, conceptId])
}

model Mastery {
  id               String        @id @default(cuid())
  userId           String
  conceptId        String
  masteryScore     Float         @default(0)
  confidenceScore  Float         @default(0)
  attemptCount     Int           @default(0)
  correctCount     Int           @default(0)
  incorrectCount   Int           @default(0)
  status           MasteryStatus @default(NOT_STARTED)
  lastAssessmentAt DateTime?
  lastInteractionAt DateTime     @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  concept Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@unique([userId, conceptId])
  @@index([userId, status])
}

model Misconception {
  id          String   @id @default(cuid())
  userId      String
  conceptId   String
  description String
  evidence    String
  resolved    Boolean  @default(false)
  detectedAt  DateTime @default(now())

  concept Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@index([userId, resolved])
}

model Assessment {
  id          String    @id @default(cuid())
  userId      String
  courseId    String?
  topicId     String?
  kind        String    @default("practice")
  score       Float?
  submittedAt DateTime?
  createdAt   DateTime  @default(now())

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  questions Question[]
  answers   Answer[]

  @@index([userId])
}

model Question {
  id            String       @id @default(cuid())
  assessmentId  String
  conceptId     String
  type          QuestionType
  prompt        String
  options       String       @default("[]")
  correctAnswer String
  explanation   String
  difficulty    Difficulty   @default(BEGINNER)
  order         Int          @default(0)

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  concept    Concept    @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  answers    Answer[]

  @@index([assessmentId])
}

model Answer {
  id           String   @id @default(cuid())
  assessmentId String
  questionId   String
  response     String
  isCorrect    Boolean
  score        Float    @default(0)
  feedback     String   @default("")
  createdAt    DateTime @default(now())

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  question   Question   @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, questionId])
}
```

- [ ] **Step 6: Append the material and concept-map models**

```prisma
model Material {
  id         String         @id @default(cuid())
  userId     String
  courseId   String?
  filename   String
  mimeType   String
  sizeBytes  Int
  status     MaterialStatus @default(UPLOADED)
  error      String?
  createdAt  DateTime       @default(now())

  user   User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  chunks MaterialChunk[]

  @@index([userId])
}

model MaterialChunk {
  id         String @id @default(cuid())
  materialId String
  content    String
  tokenCount Int    @default(0)
  order      Int

  material Material @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@unique([materialId, order])
  @@index([materialId])
}

model ConceptMap {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  nodes  ConceptMapNode[]
  edges  ConceptMapEdge[]

  @@index([userId, courseId])
}

model ConceptMapNode {
  id        String  @id @default(cuid())
  mapId     String
  conceptId String?
  label     String
  x         Float   @default(0)
  y         Float   @default(0)

  map     ConceptMap @relation(fields: [mapId], references: [id], onDelete: Cascade)
  concept Concept?   @relation(fields: [conceptId], references: [id], onDelete: SetNull)

  outgoing ConceptMapEdge[] @relation("MapFrom")
  incoming ConceptMapEdge[] @relation("MapTo")

  @@index([mapId])
}

model ConceptMapEdge {
  id     String           @id @default(cuid())
  mapId  String
  fromId String
  toId   String
  type   RelationshipType @default(RELATED_TO)
  label  String?

  map  ConceptMap     @relation(fields: [mapId], references: [id], onDelete: Cascade)
  from ConceptMapNode @relation("MapFrom", fields: [fromId], references: [id], onDelete: Cascade)
  to   ConceptMapNode @relation("MapTo", fields: [toId], references: [id], onDelete: Cascade)

  @@unique([mapId, fromId, toId])
  @@index([mapId])
}
```

- [ ] **Step 7: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

If it fails, read the error — it names the exact model and line.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma.config.ts
git commit -m "feat(db): add prisma schema for all 19 platform entities"
```

---

## Task 5: Generate client and run first migration

**Files:**
- Create: `prisma/migrations/**` (generated)
- Create: `app/generated/prisma/**` (generated)
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the generated client**

Append to `.gitignore`:

```
# Prisma generated client
/app/generated
```

- [ ] **Step 2: Create the migration**

Run: `npx prisma migrate dev --name init`
Expected: creates `prisma/migrations/<timestamp>_init/migration.sql`, applies it, then generates the client. Ends with `✔ Generated Prisma Client`.

- [ ] **Step 3: Verify the tables exist**

Run: `npx prisma db execute --stdin <<< "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`
Expected: lists `Answer`, `Assessment`, `Concept`, `ConceptMap`, `ConceptMapEdge`, `ConceptMapNode`, `ConceptRelationship`, `Course`, `LearningProgress`, `LearningSession`, `Mastery`, `Material`, `MaterialChunk`, `Misconception`, `Module`, `Question`, `Source`, `Topic`, `User`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations .gitignore
git commit -m "feat(db): initial migration"
```

---

## Task 6: Prisma client singleton

**Files:**
- Create: `lib/prisma.ts`
- Test: `tests/lib/prisma.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/prisma.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'

describe('prisma singleton', () => {
  it('exports a client with the expected models', () => {
    expect(prisma.user).toBeDefined()
    expect(prisma.course).toBeDefined()
    expect(prisma.concept).toBeDefined()
  })

  it('returns the same instance on repeat import', async () => {
    const again = (await import('@/lib/prisma')).default
    expect(again).toBe(prisma)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/prisma.test.ts`
Expected: FAIL — `Cannot find module '@/lib/prisma'`.

- [ ] **Step 3: Create `lib/prisma.ts`**

Note the `/client` suffix on the import path — Prisma 7 requires it.

```ts
import { PrismaClient } from '@/app/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/prisma.test.ts`
Expected: PASS — `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/prisma.ts tests/lib/prisma.test.ts
git commit -m "feat(db): add prisma client singleton"
```

---

## Task 7: API response envelope

Every Route Handler in every later phase returns through these helpers. Getting this right once removes a whole class of inconsistency.

**Files:**
- Create: `lib/api.ts`
- Test: `tests/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError, fail, handle, ok, parseJson } from '@/lib/api'

describe('ok', () => {
  it('wraps the payload in a data envelope with status 200', async () => {
    const res = ok({ id: '1' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { id: '1' } })
  })

  it('honours a custom status', () => {
    expect(ok({ id: '1' }, 201).status).toBe(201)
  })
})

describe('fail', () => {
  it('wraps the error in an error envelope', async () => {
    const res = fail('NOT_FOUND', 'Course not found', 404)
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Course not found' },
    })
  })
})

describe('handle', () => {
  it('returns the handler result when it succeeds', async () => {
    const res = await handle(async () => ok({ fine: true }))
    expect(res.status).toBe(200)
  })

  it('converts a thrown ApiError into its envelope', async () => {
    const res = await handle(async () => {
      throw new ApiError('FORBIDDEN', 'Nope', 403)
    })
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: 'Nope' },
    })
  })

  it('converts an unknown throw into a 500', async () => {
    const res = await handle(async () => {
      throw new Error('boom')
    })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    })
  })
})

describe('parseJson', () => {
  const schema = z.object({ title: z.string().min(1) })

  it('returns parsed data for a valid body', async () => {
    const req = new Request('http://t/', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hi' }),
    })
    await expect(parseJson(req, schema)).resolves.toEqual({ title: 'Hi' })
  })

  it('throws a VALIDATION_ERROR ApiError for an invalid body', async () => {
    const req = new Request('http://t/', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    })
    await expect(parseJson(req, schema)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/api.test.ts`
Expected: FAIL — `Cannot find module '@/lib/api'`.

- [ ] **Step 3: Create `lib/api.ts`**

```ts
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.status)
    }
    console.error('Unhandled route error:', error)
    return fail('INTERNAL_ERROR', 'Something went wrong', 500)
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first.path.join('.')
    throw new ApiError(
      'VALIDATION_ERROR',
      path ? `${path}: ${first.message}` : first.message,
      400,
    )
  }
  return result.data
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/api.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts tests/lib/api.test.ts
git commit -m "feat(api): add response envelope, error class and json parser"
```

---

## Task 8: JSON array helpers for SQLite

SQLite stores `objectives` and `options` as JSON text. These helpers keep that detail in one place.

**Files:**
- Create: `lib/json-array.ts`
- Test: `tests/lib/json-array.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/json-array.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readStringArray, writeStringArray } from '@/lib/json-array'

describe('readStringArray', () => {
  it('parses a JSON array of strings', () => {
    expect(readStringArray('["a","b"]')).toEqual(['a', 'b'])
  })

  it('returns an empty array for malformed JSON', () => {
    expect(readStringArray('not json')).toEqual([])
  })

  it('returns an empty array when the value is not an array', () => {
    expect(readStringArray('{"a":1}')).toEqual([])
  })

  it('drops non-string members', () => {
    expect(readStringArray('["a",1,null]')).toEqual(['a'])
  })
})

describe('writeStringArray', () => {
  it('serialises to JSON', () => {
    expect(writeStringArray(['a', 'b'])).toBe('["a","b"]')
  })

  it('round-trips through readStringArray', () => {
    expect(readStringArray(writeStringArray(['x', 'y']))).toEqual(['x', 'y'])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/json-array.test.ts`
Expected: FAIL — `Cannot find module '@/lib/json-array'`.

- [ ] **Step 3: Create `lib/json-array.ts`**

```ts
export function readStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function writeStringArray(values: string[]): string {
  return JSON.stringify(values)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/json-array.test.ts`
Expected: PASS — `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/json-array.ts tests/lib/json-array.test.ts
git commit -m "feat(db): add sqlite json array read/write helpers"
```

---

## Task 9: Shared Zod schemas

**Files:**
- Create: `lib/schemas/common.ts`
- Create: `lib/schemas/course.ts`
- Create: `lib/schemas/concept.ts`
- Test: `tests/lib/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { difficultySchema, paginationSchema } from '@/lib/schemas/common'
import { courseSummarySchema } from '@/lib/schemas/course'
import { conceptSchema, relationshipTypeSchema } from '@/lib/schemas/concept'

describe('paginationSchema', () => {
  it('applies defaults when fields are absent', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 })
  })

  it('coerces numeric strings from query params', () => {
    expect(paginationSchema.parse({ page: '3' }).page).toBe(3)
  })

  it('rejects a page below 1', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('caps perPage at 100', () => {
    expect(paginationSchema.safeParse({ perPage: 101 }).success).toBe(false)
  })
})

describe('difficultySchema', () => {
  it('accepts a known level', () => {
    expect(difficultySchema.parse('BEGINNER')).toBe('BEGINNER')
  })

  it('rejects an unknown level', () => {
    expect(difficultySchema.safeParse('EXPERT').success).toBe(false)
  })
})

describe('courseSummarySchema', () => {
  it('accepts a well formed course', () => {
    const parsed = courseSummarySchema.parse({
      id: 'c1',
      slug: 'generative-ai',
      title: 'Generative AI',
      description: 'Foundations of generative models.',
      category: 'AI',
      difficulty: 'BEGINNER',
      estimatedHours: 6,
      moduleCount: 3,
      conceptCount: 24,
    })
    expect(parsed.slug).toBe('generative-ai')
  })

  it('rejects a slug with spaces', () => {
    const result = courseSummarySchema.safeParse({
      id: 'c1',
      slug: 'not a slug',
      title: 'T',
      description: 'D',
      category: 'AI',
      difficulty: 'BEGINNER',
      estimatedHours: 1,
      moduleCount: 0,
      conceptCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('conceptSchema', () => {
  it('accepts a concept with objectives as a real array', () => {
    const parsed = conceptSchema.parse({
      id: 'x1',
      courseId: 'c1',
      name: 'Tokenization',
      definition: 'Splitting text into tokens.',
      difficulty: 'BEGINNER',
      objectives: ['Define a token'],
    })
    expect(parsed.objectives).toEqual(['Define a token'])
  })

  it('defaults objectives to an empty array', () => {
    const parsed = conceptSchema.parse({
      id: 'x1',
      courseId: 'c1',
      name: 'Tokenization',
      definition: 'Splitting text into tokens.',
      difficulty: 'BEGINNER',
    })
    expect(parsed.objectives).toEqual([])
  })
})

describe('relationshipTypeSchema', () => {
  it('accepts all four relationship types', () => {
    for (const t of ['PREREQUISITE_OF', 'RELATED_TO', 'PART_OF', 'LEADS_TO']) {
      expect(relationshipTypeSchema.parse(t)).toBe(t)
    }
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/common'`.

- [ ] **Step 3: Create `lib/schemas/common.ts`**

```ts
import { z } from 'zod'

export const idSchema = z.string().min(1, 'id is required')

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug')

export const difficultySchema = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
])

export const masteryStatusSchema = z.enum([
  'NOT_STARTED',
  'LEARNING',
  'PRACTICING',
  'MASTERED',
  'NEEDS_REVIEW',
])

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type Difficulty = z.infer<typeof difficultySchema>
export type MasteryStatus = z.infer<typeof masteryStatusSchema>
export type Pagination = z.infer<typeof paginationSchema>
```

- [ ] **Step 4: Create `lib/schemas/course.ts`**

```ts
import { z } from 'zod'
import { difficultySchema, idSchema, slugSchema } from './common'

export const courseSummarySchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  difficulty: difficultySchema,
  estimatedHours: z.number().int().min(0),
  moduleCount: z.number().int().min(0),
  conceptCount: z.number().int().min(0),
})

export const topicSummarySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string(),
  order: z.number().int().min(0),
  conceptCount: z.number().int().min(0),
})

export const moduleSummarySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string(),
  order: z.number().int().min(0),
  topics: z.array(topicSummarySchema),
})

export const courseDetailSchema = courseSummarySchema.extend({
  modules: z.array(moduleSummarySchema),
})

export type CourseSummary = z.infer<typeof courseSummarySchema>
export type ModuleSummary = z.infer<typeof moduleSummarySchema>
export type TopicSummary = z.infer<typeof topicSummarySchema>
export type CourseDetail = z.infer<typeof courseDetailSchema>
```

- [ ] **Step 5: Create `lib/schemas/concept.ts`**

```ts
import { z } from 'zod'
import { difficultySchema, idSchema } from './common'

export const relationshipTypeSchema = z.enum([
  'PREREQUISITE_OF',
  'RELATED_TO',
  'PART_OF',
  'LEADS_TO',
])

export const conceptSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  moduleId: idSchema.nullable().optional(),
  topicId: idSchema.nullable().optional(),
  name: z.string().min(1),
  definition: z.string().min(1),
  difficulty: difficultySchema,
  objectives: z.array(z.string()).default([]),
})

export const conceptRelationshipSchema = z.object({
  id: idSchema,
  fromId: idSchema,
  toId: idSchema,
  type: relationshipTypeSchema,
  strength: z.number().min(0).max(1).default(1),
})

export const conceptGraphSchema = z.object({
  concepts: z.array(conceptSchema),
  relationships: z.array(conceptRelationshipSchema),
})

export type RelationshipType = z.infer<typeof relationshipTypeSchema>
export type ConceptDto = z.infer<typeof conceptSchema>
export type ConceptRelationshipDto = z.infer<typeof conceptRelationshipSchema>
export type ConceptGraph = z.infer<typeof conceptGraphSchema>
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas.test.ts`
Expected: PASS — `11 passed`.

- [ ] **Step 7: Commit**

```bash
git add lib/schemas tests/lib/schemas.test.ts
git commit -m "feat(schemas): add shared zod contracts for course and concept"
```

---

## Task 10: Install the shadcn components used across all phases

**Files:**
- Create: `components/ui/*.tsx` (generated by the CLI)

- [ ] **Step 1: Add the base component set**

Run:

```bash
npx shadcn@latest add card badge separator skeleton alert empty input label field textarea tabs dialog sheet dropdown-menu avatar progress scroll-area sonner spinner tooltip sidebar breadcrumb --yes
```

Expected: writes files into `components/ui/` and may add `@base-ui/react` sub-packages.

- [ ] **Step 2: Verify the critical ones landed**

Run: `ls components/ui/`
Expected: includes at minimum `card.tsx`, `badge.tsx`, `field.tsx`, `empty.tsx`, `skeleton.tsx`, `sidebar.tsx`, `sonner.tsx`, `spinner.tsx`.

If `field.tsx` or `empty.tsx` is missing, add it explicitly: `npx shadcn@latest add field empty --yes`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/ui package.json package-lock.json
git commit -m "feat(ui): install shared shadcn component set"
```

---

## Task 11: TanStack Query provider

**Files:**
- Create: `lib/query-provider.tsx`
- Test: `tests/lib/query-provider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/query-provider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryProvider } from '@/lib/query-provider'

describe('QueryProvider', () => {
  it('renders its children', () => {
    render(
      <QueryProvider>
        <p>inside</p>
      </QueryProvider>,
    )
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/query-provider.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/query-provider'`.

- [ ] **Step 3: Create `lib/query-provider.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/query-provider.test.tsx`
Expected: PASS — `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/query-provider.tsx tests/lib/query-provider.test.tsx
git commit -m "feat(ui): add tanstack query provider"
```

---

## Task 12: Typed fetch client

Every client component fetches through this, so the `{ data }` / `{ error }` envelope is unwrapped in exactly one place.

**Files:**
- Create: `lib/fetcher.ts`
- Test: `tests/lib/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/fetcher.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/fetcher'

function mockFetch(body: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetch', () => {
  it('unwraps the data envelope', async () => {
    mockFetch({ data: { id: '1' } })
    await expect(apiFetch('/api/courses')).resolves.toEqual({ id: '1' })
  })

  it('throws the server message on an error envelope', async () => {
    mockFetch({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404)
    await expect(apiFetch('/api/courses/x')).rejects.toThrow('Course not found')
  })

  it('throws a generic message when the body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('<html>', { status: 500 }))
    await expect(apiFetch('/api/courses')).rejects.toThrow('Request failed')
  })

  it('sends a JSON content-type when given a body', async () => {
    mockFetch({ data: { ok: true } })
    await apiFetch('/api/courses', { method: 'POST', json: { title: 'X' } })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"title":"X"}')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/fetcher.test.ts`
Expected: FAIL — `Cannot find module '@/lib/fetcher'`.

- [ ] **Step 3: Create `lib/fetcher.ts`**

```ts
type FetchOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
}

export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Request failed')
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error
  ) {
    const err = payload.error as { message?: string }
    throw new Error(err.message ?? 'Request failed')
  }

  if (!response.ok) {
    throw new Error('Request failed')
  }

  return (payload as { data: T }).data
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/fetcher.test.ts`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/fetcher.ts tests/lib/fetcher.test.ts
git commit -m "feat(api): add typed fetch client that unwraps the response envelope"
```

---

## Task 13: Application shell

**Files:**
- Create: `components/nav-main.tsx`
- Create: `components/mode-toggle.tsx`
- Create: `components/app-shell.tsx`
- Test: `tests/components/nav-main.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/nav-main.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NAV_ITEMS } from '@/components/nav-main'

vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
}))

describe('NAV_ITEMS', () => {
  it('lists the six primary destinations', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/explore',
      '/progress',
      '/materials',
      '/concept-map',
      '/profile',
      '/admin',
    ])
  })

  it('gives every item a label and an icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/nav-main.test.tsx`
Expected: FAIL — `Cannot find module '@/components/nav-main'`.

- [ ] **Step 3: Create `components/nav-main.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass,
  FileText,
  LayoutDashboard,
  Network,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/progress', label: 'Progress', icon: LayoutDashboard },
  { href: '/materials', label: 'Materials', icon: FileText },
  { href: '/concept-map', label: 'Concept Maps', icon: Network },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export function NavMain() {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                <Icon data-icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/nav-main.test.tsx`
Expected: PASS — `2 passed`.

- [ ] **Step 5: Create `components/mode-toggle.tsx`**

```tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      <Sun data-icon className="dark:hidden" />
      <Moon data-icon className="hidden dark:block" />
    </Button>
  )
}
```

- [ ] **Step 6: Create `components/app-shell.tsx`**

```tsx
import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { ModeToggle } from '@/components/mode-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
            <GraduationCap data-icon className="size-5 text-primary" />
            <span className="font-semibold group-data-[collapsible=icon]:hidden">
              Adaptive
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavMain />
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add components/nav-main.tsx components/mode-toggle.tsx components/app-shell.tsx tests/components/nav-main.test.tsx
git commit -m "feat(ui): add sidebar app shell with navigation and theme toggle"
```

---

## Task 14: Wire providers into the root layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

Keep the existing font setup; add the query provider, the shell and the toaster.

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/lib/query-provider'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Adaptive — AI Learning Platform',
  description:
    'Learn technology concepts with an AI tutor that adapts to what you actually understand.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

If the existing `ThemeProvider` requires props such as `attribute="class"`, keep them — open `components/theme-provider.tsx` and match its signature rather than guessing.

- [ ] **Step 2: Replace `app/page.tsx` with a temporary placeholder**

Phase 9 builds the real landing page. For now, prove the shell renders.

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adaptive</CardTitle>
        <CardDescription>
          Foundation is in place. Start with Phase 1 to build the course catalog.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Use the sidebar to navigate. Most destinations are not built yet.
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Run the dev server and look at it**

Run: `npm run dev`
Open `http://localhost:3000`.
Expected: sidebar on the left with six items, a header with a collapse trigger and a theme toggle, and the placeholder card in the main area. Clicking the toggle switches light/dark. Stop the server with `Ctrl+C`.

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat(ui): wire query provider, app shell and toaster into root layout"
```

---

## Phase 0 Exit Checklist

- [ ] `npx prisma validate` passes
- [ ] 19 tables exist in `prisma/dev.db`
- [ ] `npm test` passes with at least 34 assertions across 7 test files
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run dev` renders the shell with working navigation and theme toggle
- [ ] `.env` contains a real `GEMINI_API_KEY` and a generated `JWT_SECRET`
- [ ] `.env` is not tracked by git

Update `PROGRESS.md`, then proceed to [`phase-01-course-catalog.md`](./phase-01-course-catalog.md).
