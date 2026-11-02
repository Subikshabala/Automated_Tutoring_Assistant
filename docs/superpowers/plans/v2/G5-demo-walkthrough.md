# G5 — Demo Walkthrough

**Depends on:** every other chunk. This is the last one.

**Problem:** a fresh install has three seeded courses and zero learner data. Every page that depends on history — Progress, Profile, the adaptive engine, misconceptions — shows an empty state. Demoing the product means spending fifteen minutes generating data by hand before anything interesting appears, with live AI calls at every step.

**Decision:** a seeded demo account with realistic history, and a written click-path. Someone should be able to clone the repo, run two commands, and show the product in five minutes.

---

## Task 1: Demo seed script

**File:** create `scripts/seed-demo.ts`

Generates a learner mid-way through Generative AI Foundations: some concepts mastered, some shaky, one clear misconception, a session history, an uploaded document, and a saved concept map.

- [ ] **Step 1: Set up the client**

Mirror the adapter pattern from `prisma/seed.ts`.

```ts
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import path from 'node:path'
import { hashPassword } from '../lib/auth/password'

const adapter = new PrismaLibSQL({
  url: `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`,
})
const prisma = new PrismaClient({ adapter })

const DEMO_EMAIL = 'demo@adaptive.local'
const DEMO_PASSWORD = 'demo-password-1234'
```

- [ ] **Step 2: Shape the learner**

The point is a learner whose data tells a story, not random numbers.

```ts
/**
 * A learner who understands the input pipeline but has not grasped
 * attention, and who holds one specific, nameable misconception.
 *
 * This shape is deliberate: it gives the adaptive engine something to
 * reason about and gives the Progress page a mix of situations.
 */
const MASTERY_PLAN: { concept: string; score: number; attempts: number }[] = [
  { concept: 'Tokenization',   score: 92, attempts: 3 },
  { concept: 'Embeddings',     score: 85, attempts: 2 },
  { concept: 'Context Window', score: 71, attempts: 2 },
  { concept: 'Attention',      score: 38, attempts: 2 },
  { concept: 'Temperature and Sampling', score: 55, attempts: 1 },
]

const MISCONCEPTION = {
  concept: 'Attention',
  description:
    'Believes attention compares each token only to the one before it',
  evidence:
    'Q: Explain attention in terms of query, key and value.\n' +
    'A: Each token looks at the previous token and decides how much to carry forward.',
}
```

That produces, on Progress:

| Concept | Situation shown |
|---|---|
| Attention | `BLOCKED_DOWNSTREAM` — top of the list |
| Temperature and Sampling | `SHAKY` |
| Context Window | `NEARLY_THERE` |
| Prompt Engineering concepts | `READY` |

Four different situations, which is exactly what E1 was built for.

- [ ] **Step 3: Write mastery with correct status**

Do not insert rows directly — go through `recordAttempt` so the status thresholds and EMA produce the same values the live app would.

```ts
async function seedMastery(userId: string) {
  for (const plan of MASTERY_PLAN) {
    const concept = await prisma.concept.findFirst({
      where: { name: plan.concept },
    })
    if (!concept) {
      console.warn(`  skipping unknown concept "${plan.concept}"`)
      continue
    }

    // Replay attempts so the EMA lands near the target score.
    const target = plan.score / 100
    for (let i = 0; i < plan.attempts; i++) {
      await recordAttempt(userId, concept.id, target)
    }
  }
}
```

Import `recordAttempt` from the repository. Reusing production code means the demo data cannot drift from what the app actually produces.

- [ ] **Step 4: Session history**

Backdate so the resume card and "last active" read plausibly.

```ts
async function seedSessions(userId: string) {
  const topics = await prisma.topic.findMany({
    where: { module: { course: { slug: 'generative-ai' } } },
    orderBy: { order: 'asc' },
    take: 2,
  })

  const now = Date.now()
  for (const [index, topic] of topics.entries()) {
    const startedAt = new Date(now - (index + 1) * 36e5)
    await prisma.learningSession.create({
      data: {
        userId,
        topicId: topic.id,
        courseId: (await prisma.module.findUniqueOrThrow({
          where: { id: topic.moduleId },
          select: { courseId: true },
        })).courseId,
        startedAt,
        // Leave the most recent one open so Progress shows a resume card.
        endedAt: index === 0 ? null : new Date(startedAt.getTime() + 18e5),
      },
    })
  }
}
```

- [ ] **Step 5: A document to query**

Write a real file and run it through the production upload path so it gets chunked and embedded exactly as a user upload would.

```ts
const DEMO_DOC = `# Transformer Architecture Notes

## Self-Attention
Self-attention lets every token attend to every other token in the sequence,
not merely its immediate neighbour. Each token produces a query, a key and a
value. The query is compared against every key to produce weights, and those
weights mix the values.

This is the point most explanations skip: the comparison is all-to-all. A
token at position 50 can attend directly to position 1 with no intermediate
hops.

## Multi-Head Attention
Running several attention operations in parallel lets each head specialise.
One may track syntax, another coreference. Their outputs are concatenated and
projected back to the model dimension.

## Positional Encoding
Attention is permutation-invariant, so position must be injected explicitly.
Without it, "the cat sat on the mat" and "the mat sat on the cat" produce
identical representations.
`
```

The Self-Attention section deliberately contradicts the seeded misconception. A demo can show the misconception on Progress, then ask the uploaded document about attention and watch the correction surface from the learner's own material.

- [ ] **Step 6: A saved concept map**

Partially correct, so **Compare** has something to report.

```ts
const DEMO_MAP = {
  title: 'My first attempt',
  nodes: ['Tokenization', 'Embeddings', 'Attention', 'Prompt Engineering'],
  // Deliberately wrong: skips Embeddings between Tokenization and Attention.
  edges: [
    ['Tokenization', 'Attention'],
    ['Attention', 'Prompt Engineering'],
  ],
}
```

Missing a real prerequisite and inventing one that does not exist — the comparison will flag both.

- [ ] **Step 7: Idempotency**

```ts
async function main() {
  console.log('Seeding demo account...')

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Learner',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      diagnosedCourses: JSON.stringify(['generative-ai']),
    },
    update: {},
  })

  // Wipe prior demo data so repeat runs converge rather than accumulate.
  await prisma.mastery.deleteMany({ where: { userId: user.id } })
  await prisma.misconception.deleteMany({ where: { userId: user.id } })
  await prisma.learningSession.deleteMany({ where: { userId: user.id } })
  await prisma.learningProgress.deleteMany({ where: { userId: user.id } })
  await prisma.conceptMap.deleteMany({ where: { userId: user.id } })
  await prisma.material.deleteMany({ where: { userId: user.id } })

  await seedMastery(user.id)
  await seedMisconception(user.id)
  await seedSessions(user.id)
  await seedProgress(user.id)
  await seedMaterial(user.id)
  await seedConceptMap(user.id)

  console.log(`\nDemo account ready:`)
  console.log(`  ${DEMO_EMAIL}`)
  console.log(`  ${DEMO_PASSWORD}\n`)
}
```

- [ ] **Step 8: Add the script**

```json
"db:demo": "tsx scripts/seed-demo.ts"
```

- [ ] **Step 9: Run and verify**

```bash
npm run db:demo
```

```bash
npx prisma db execute --stdin <<< "SELECT c.name, m.masteryScore, m.status FROM Mastery m JOIN Concept c ON c.id = m.conceptId ORDER BY m.masteryScore DESC;"
```

Expected: five rows matching the plan, with statuses spread across `MASTERED`, `PRACTICING`, `LEARNING`, `NEEDS_REVIEW`.

- [ ] **Step 10: Commit**

```bash
git add scripts/seed-demo.ts package.json
git commit -m "feat(demo): add demo account seed with realistic learner history"
```

---

## Task 2: Reset script

A demo gets poked at. Make recovery one command.

**File:** create `scripts/reset-demo.ts`

```ts
// Drops all learner data but keeps courses and concepts, then reseeds
// the demo account. Faster than a full migrate reset and does not need
// the embedding backfill to run again.
```

Delete in dependency order: `Answer`, `Question`, `Assessment`, `Mastery`, `Misconception`, `LearningProgress`, `LearningSession`, `ConceptMapEdge`, `ConceptMapNode`, `ConceptMap`, `MaterialChunk`, `Material`, then non-admin `User` rows. Then invoke the demo seed.

```json
"db:reset-demo": "tsx scripts/reset-demo.ts"
```

---

## Task 3: The walkthrough

**File:** create `docs/DEMO.md`

A click-path with what to say at each step. Written for someone presenting, including you in three weeks when you have forgotten the details.

```markdown
# Demo Walkthrough

Five minutes, eight stops. Assumes `npm run db:seed && npm run db:demo`
and a dev server on :3000.

Sign in as `demo@adaptive.local` / `demo-password-1234`.

---

## 1. Landing — 20s

Scroll to **How it works**. The connector fills as it enters view.

> The claim is specific: it finds where your understanding stops, then
> teaches from there. Everything after this is that claim being tested.

## 2. Progress — 60s

The centrepiece. Point at **What to do next**.

> Four recommendations, four different reasons. Attention is top because
> it is blocking two downstream concepts, not because it is next in a list.

Then **Worth revisiting**.

> This is not "you got question three wrong." The system identified a
> specific belief — that attention only compares adjacent tokens — from
> how the answer was phrased.

Click **Work through it**. Note the response asks rather than tells.

## 3. Concept map — 45s

`/courses/generative-ai/map`.

> Every course is a prerequisite graph. Animated edges are hard
> dependencies. You are never sent somewhere you are not ready for.

Click **Attention**. The panel fills. Click **Embeddings** under
Prerequisites — the canvas pans.

## 4. Learn — 60s

Click a topic. Explanations are generated and cached.

> Explanation, worked example, and a check question. The map is embedded
> so structure stays visible while you read.

Ask the tutor something. Answer arrives in a few seconds.

## 5. Assessment — 60s

**Test yourself**. Answer one short question *specifically wrong* —
for example "each word becomes one token."

> MCQs are graded deterministically. Short answers go to the model, which
> grades understanding rather than keyword overlap — and records the
> misconception it spots.

Submit. The new misconception appears on Progress.

## 6. Materials — 45s

`/materials/...` — the seeded transformer notes.

Ask: **what is this**

> Worth noting: keyword search returns nothing for that question. This is
> semantic retrieval running locally, no API.

Then: **does attention only look at the previous token?**

> The answer corrects the misconception from step 2, grounded in their
> own uploaded document with the passage quoted.

Then ask something off-topic. It declines.

## 7. Student map — 45s

`/courses/generative-ai/my-map` — the saved attempt loads.

Click **Compare**.

> It caught the missing Tokenization → Embeddings link and the invented
> Tokenization → Attention one. The comparison is deterministic; only the
> wording is generated.

## 8. Admin — 30s

Requires `npx tsx scripts/make-admin.ts demo@adaptive.local` and a re-login.

> Who is stuck, which concepts nobody reaches, and source attribution.

---

## If something fails

| Symptom | Cause |
|---|---|
| `AI_NOT_CONFIGURED` | `GROQ_API_KEY` missing from `.env` |
| `AI_UNAVAILABLE` | Rate limit. Switch `LLM_PROVIDER` to `gemini` or `ollama` |
| Material Q&A slow on first ask | Embedding model loading, ~2s once per process |
| Empty Progress | `npm run db:demo` not run |
```

---

## Task 4: README

**File:** modify `README.md`

- [ ] **Step 1: Correct the setup**

The current README says `GEMINI_API_KEY`. After A1 that is one option among several. Lead with Groq.

- [ ] **Step 2: Add the demo path**

```markdown
## Try it quickly

```bash
npm install --legacy-peer-deps
cp .env.example .env     # add GROQ_API_KEY from console.groq.com
npx prisma migrate deploy
npm run db:seed          # 3 courses, 28 concepts
npm run db:demo          # a learner with history
npm run dev
```

Sign in as `demo@adaptive.local` / `demo-password-1234`, then follow
[`docs/DEMO.md`](./docs/DEMO.md).
```

- [ ] **Step 3: Correct what is stale**

v1's README listed misconception tracking and session logging under *Next*. After G2 and G3 they are built. The architecture section still describes keyword retrieval — that is now hybrid semantic.

---

## Task 5: Final verification

- [ ] **Step 1: Clean install**

The real test. Everything from nothing.

```bash
rm -rf node_modules .next app/generated prisma/dev.db .cache
npm install --legacy-peer-deps
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run db:demo
```

All six must succeed with no manual intervention.

- [ ] **Step 2: Full gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

- [ ] **Step 3: Walk the demo**

Follow `docs/DEMO.md` end to end against `npm run start`, not dev. Time it. If any step takes longer than the stated budget or needs an unlisted workaround, fix the script or the doc.

- [ ] **Step 4: Confirm the v2 issues are closed**

| From the user's reports | Chunk | Check |
|---|---|---|
| Menu crash | A2 | Account menu opens |
| Dead Gemini model | A1 | Explanations generate |
| `/concept-map` 404 | A3 | Index page renders |
| RAG returns nothing | B2 | "what is this" answers |
| Materials upload broken | B3 | Upload and query work |
| Clumsy concept map | C1 | Readable spacing |
| Messy edges, bad labels | C2 | Themed, distinct |
| Panel should navigate | C3 | Refs are buttons |
| Add not working | D1 | Node appears in view |
| Want predefined concepts | D2 | Palette present |
| Recommendations read AI-generated | E1 | Four distinct reasons |
| Curriculum all expanded | E2 | First open, rest collapsed |
| No 1→4 progress line | F1 | Connector fills |
| Line artifact | F2 | Gone at 200% zoom |
| "What is the admin one?" | G4 | Admin does something |

- [ ] **Step 5: Commit**

```bash
git add docs/DEMO.md README.md scripts/reset-demo.ts PROGRESS.md
git commit -m "docs: add demo walkthrough and refresh setup instructions"
```

---

## Exit checklist

- [ ] `npm run db:demo` is idempotent
- [ ] Demo learner shows four distinct recommendation situations
- [ ] The seeded misconception is contradicted by the seeded document
- [ ] The saved map has both a missing and an invented edge
- [ ] Resume card appears
- [ ] `docs/DEMO.md` runs in five minutes with no undocumented steps
- [ ] Clean install works from zero
- [ ] Every reported issue is closed
- [ ] All four verification commands pass

---

## v2 complete

Nineteen chunks. The app runs, the AI works, retrieval is semantic, the
maps are legible, the copy reads like a person wrote it, and four dead
tables now carry real data.
