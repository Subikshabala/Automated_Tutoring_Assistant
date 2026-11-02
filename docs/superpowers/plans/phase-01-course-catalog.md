# Phase 1 — Course Catalog

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner can browse a catalog of real courses, filter by category and difficulty, open a course, and see its modules and topics — all driven by real database rows.

**Architecture:** Seed script writes three full courses into SQLite. A repository layer (`lib/repositories/course.ts`) owns all Prisma access and shapes rows into the Zod DTOs from Phase 0. Two Route Handlers expose list and detail. Two Server Components render them, with a client-side filter bar.

**Tech Stack:** Prisma · Zod · Next.js Route Handlers · React Server Components · shadcn/ui

**Depends on:** Phase 0 complete.

**Done when:** `/explore` lists 3 seeded courses with working category and difficulty filters, and clicking one opens `/courses/<slug>` showing its modules and topics.

---

## File Structure

| Path | Responsibility |
|---|---|
| `prisma/seed-data/generative-ai.ts` | Course 1 content |
| `prisma/seed-data/cybersecurity.ts` | Course 2 content |
| `prisma/seed-data/ai-agents.ts` | Course 3 content |
| `prisma/seed-data/types.ts` | Shape of a seed course |
| `prisma/seed.ts` | Idempotent seeding runner |
| `lib/repositories/course.ts` | All course/module/topic Prisma queries |
| `app/api/courses/route.ts` | `GET /api/courses` — list with filters |
| `app/api/courses/[slug]/route.ts` | `GET /api/courses/:slug` — detail |
| `components/course-card.tsx` | One course in the grid |
| `components/course-filters.tsx` | Category + difficulty filter bar |
| `app/explore/page.tsx` | Catalog page |
| `app/explore/loading.tsx` | Skeleton grid |
| `app/courses/[slug]/page.tsx` | Course detail page |
| `app/courses/[slug]/not-found.tsx` | Unknown slug state |

---

## Task 1: Seed data types

**Files:**
- Create: `prisma/seed-data/types.ts`

- [ ] **Step 1: Create the file**

These are plain TypeScript shapes, not Zod — the seed runs once at build time and a type error is enough.

```ts
export type SeedConcept = {
  name: string
  definition: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  objectives: string[]
}

export type SeedTopic = {
  title: string
  description: string
  concepts: SeedConcept[]
}

export type SeedModule = {
  title: string
  description: string
  topics: SeedTopic[]
}

export type SeedRelationship = {
  from: string
  to: string
  type: 'PREREQUISITE_OF' | 'RELATED_TO' | 'PART_OF' | 'LEADS_TO'
}

export type SeedCourse = {
  slug: string
  title: string
  description: string
  category: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  estimatedHours: number
  modules: SeedModule[]
  relationships: SeedRelationship[]
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-data/types.ts
git commit -m "feat(seed): add seed data types"
```

---

## Task 2: Generative AI course content

**Files:**
- Create: `prisma/seed-data/generative-ai.ts`

- [ ] **Step 1: Create the file**

```ts
import type { SeedCourse } from './types'

export const generativeAi: SeedCourse = {
  slug: 'generative-ai',
  title: 'Generative AI Foundations',
  description:
    'Understand how modern language models represent text, generate it, and how to steer them reliably.',
  category: 'Artificial Intelligence',
  difficulty: 'BEGINNER',
  estimatedHours: 8,
  modules: [
    {
      title: 'How Language Models Work',
      description:
        'The mechanics underneath a chat response: tokens, embeddings, attention and sampling.',
      topics: [
        {
          title: 'Text Representation',
          description: 'How raw text becomes numbers a model can compute over.',
          concepts: [
            {
              name: 'Tokenization',
              definition:
                'The process of splitting raw text into tokens — subword units from a fixed vocabulary — so a model can map each piece to an integer id.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain why models operate on subwords rather than characters or whole words',
                'Predict roughly how many tokens a given English sentence produces',
                'Describe why token count, not word count, drives cost and context limits',
              ],
            },
            {
              name: 'Embeddings',
              definition:
                'Dense vector representations of tokens where geometric closeness encodes semantic similarity, learned during training.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain what it means for two embeddings to be close',
                'Distinguish a token embedding from a sentence embedding',
                'Describe why embeddings enable semantic search',
              ],
            },
            {
              name: 'Context Window',
              definition:
                'The maximum number of tokens a model can attend to in a single forward pass, covering both the prompt and the generated output.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain what happens when input exceeds the context window',
                'Describe why long conversations degrade without summarisation',
              ],
            },
          ],
        },
        {
          title: 'Generation Mechanics',
          description: 'How the next token is chosen, and how that choice is controlled.',
          concepts: [
            {
              name: 'Attention',
              definition:
                'A mechanism that lets each token weigh the relevance of every other token in the context when computing its own representation.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain attention in terms of query, key and value',
                'Describe why attention cost grows quadratically with sequence length',
              ],
            },
            {
              name: 'Temperature and Sampling',
              definition:
                'Decoding parameters that reshape the next-token probability distribution, trading determinism against diversity.',
              difficulty: 'BEGINNER',
              objectives: [
                'Predict the effect of raising temperature from 0 to 1',
                'Choose a sampling setting appropriate to a given task',
                'Distinguish temperature from top-p',
              ],
            },
            {
              name: 'Hallucination',
              definition:
                'Fluent, confident model output that is not grounded in training data or provided context — a consequence of next-token prediction, not a bug.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain why hallucination is structural rather than accidental',
                'Name two mitigation strategies and their limits',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Working With Models',
      description: 'Practical control: prompting, structured output, and grounding.',
      topics: [
        {
          title: 'Prompt Engineering',
          description: 'Shaping inputs so outputs are reliable rather than lucky.',
          concepts: [
            {
              name: 'Zero-Shot and Few-Shot Prompting',
              definition:
                'Instructing a model with no worked examples (zero-shot) or with a handful of input-output demonstrations in the prompt (few-shot).',
              difficulty: 'BEGINNER',
              objectives: [
                'Decide when examples are worth their token cost',
                'Write a few-shot prompt with consistent formatting',
              ],
            },
            {
              name: 'Chain-of-Thought Prompting',
              definition:
                'Prompting a model to produce intermediate reasoning steps before its final answer, improving accuracy on multi-step problems.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Identify task types where chain-of-thought helps',
                'Explain the latency and cost tradeoff',
              ],
            },
            {
              name: 'Structured Output',
              definition:
                'Constraining a model to emit a specific schema — typically JSON — so its response can be parsed and validated programmatically.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Describe why free text is unsafe as an API boundary',
                'Explain why schema validation is still required after constrained decoding',
              ],
            },
          ],
        },
        {
          title: 'Grounding',
          description: 'Connecting a model to facts it was never trained on.',
          concepts: [
            {
              name: 'Retrieval-Augmented Generation',
              definition:
                'Retrieving relevant source passages at query time and placing them in the prompt so the model answers from provided evidence rather than memory.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Describe the retrieve-then-generate pipeline',
                'Explain why RAG reduces but does not eliminate hallucination',
                'Identify when fine-tuning is the better tool',
              ],
            },
            {
              name: 'Semantic Search',
              definition:
                'Finding passages by embedding similarity rather than keyword overlap, so conceptually related text matches even without shared words.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Contrast semantic search with keyword search',
                'Explain why chunk size affects retrieval quality',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'Tokenization', to: 'Embeddings', type: 'PREREQUISITE_OF' },
    { from: 'Embeddings', to: 'Attention', type: 'PREREQUISITE_OF' },
    { from: 'Tokenization', to: 'Context Window', type: 'PREREQUISITE_OF' },
    { from: 'Attention', to: 'Temperature and Sampling', type: 'LEADS_TO' },
    { from: 'Temperature and Sampling', to: 'Hallucination', type: 'LEADS_TO' },
    { from: 'Zero-Shot and Few-Shot Prompting', to: 'Chain-of-Thought Prompting', type: 'PREREQUISITE_OF' },
    { from: 'Chain-of-Thought Prompting', to: 'Structured Output', type: 'RELATED_TO' },
    { from: 'Embeddings', to: 'Semantic Search', type: 'PREREQUISITE_OF' },
    { from: 'Semantic Search', to: 'Retrieval-Augmented Generation', type: 'PREREQUISITE_OF' },
    { from: 'Hallucination', to: 'Retrieval-Augmented Generation', type: 'LEADS_TO' },
    { from: 'Context Window', to: 'Retrieval-Augmented Generation', type: 'RELATED_TO' },
  ],
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-data/generative-ai.ts
git commit -m "feat(seed): add generative ai course content"
```

---

## Task 3: Cybersecurity course content

**Files:**
- Create: `prisma/seed-data/cybersecurity.ts`

- [ ] **Step 1: Create the file**

```ts
import type { SeedCourse } from './types'

export const cybersecurity: SeedCourse = {
  slug: 'cybersecurity-essentials',
  title: 'Cybersecurity Essentials',
  description:
    'The threat models, controls and reasoning patterns behind defending real systems.',
  category: 'Security',
  difficulty: 'BEGINNER',
  estimatedHours: 10,
  modules: [
    {
      title: 'Security Foundations',
      description: 'The vocabulary and mental models every other topic builds on.',
      topics: [
        {
          title: 'Core Principles',
          description: 'What security is actually trying to preserve.',
          concepts: [
            {
              name: 'CIA Triad',
              definition:
                'Confidentiality, Integrity and Availability — the three properties security controls exist to preserve, often in tension with one another.',
              difficulty: 'BEGINNER',
              objectives: [
                'Classify a given incident by which property it violated',
                'Give an example where protecting one property degrades another',
              ],
            },
            {
              name: 'Threat Modeling',
              definition:
                'Systematically enumerating what can go wrong in a system by asking who the attacker is, what they want, and where the trust boundaries are.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Identify trust boundaries in a simple web architecture',
                'Apply STRIDE to one component',
              ],
            },
            {
              name: 'Defense in Depth',
              definition:
                'Layering independent controls so that the failure of any single control does not result in compromise.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain why a single strong control is riskier than several weaker layers',
                'Identify the layers protecting a typical login flow',
              ],
            },
          ],
        },
        {
          title: 'Identity and Access',
          description: 'Proving who someone is, and bounding what they may do.',
          concepts: [
            {
              name: 'Authentication vs Authorization',
              definition:
                'Authentication establishes identity; authorization determines what that identity is permitted to do. They are separate decisions made at separate times.',
              difficulty: 'BEGINNER',
              objectives: [
                'Classify a given check as authn or authz',
                'Explain why authorization must be re-checked on every request',
              ],
            },
            {
              name: 'Principle of Least Privilege',
              definition:
                'Granting each identity the minimum permissions required for its function, for the minimum time necessary.',
              difficulty: 'BEGINNER',
              objectives: [
                'Spot an over-privileged service account',
                'Explain how least privilege limits blast radius',
              ],
            },
            {
              name: 'Zero Trust',
              definition:
                'An architecture that treats network location as conveying no trust, requiring explicit verification of every request regardless of origin.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Contrast zero trust with perimeter security',
                'Describe what must be verified on an internal service call',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Attacks and Defenses',
      description: 'How real systems get broken, and what actually stops it.',
      topics: [
        {
          title: 'Application Attacks',
          description: 'The injection and trust failures that dominate real breaches.',
          concepts: [
            {
              name: 'SQL Injection',
              definition:
                'An attack where untrusted input is concatenated into a SQL statement, allowing the attacker to alter the query structure the database executes.',
              difficulty: 'BEGINNER',
              objectives: [
                'Identify vulnerable string concatenation in query code',
                'Explain why parameterised queries fix it and escaping does not',
              ],
            },
            {
              name: 'Cross-Site Scripting',
              definition:
                'Injection of attacker-controlled script into a page, executing in a victim browser with that origin\u2019s privileges.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Distinguish stored, reflected and DOM-based XSS',
                'Explain why output encoding must be context-aware',
              ],
            },
            {
              name: 'Cryptographic Hashing',
              definition:
                'A one-way function mapping arbitrary input to a fixed-size digest; password storage additionally requires a slow, salted function such as bcrypt or Argon2.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain why fast hashes are wrong for passwords',
                'Describe what a salt prevents',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'CIA Triad', to: 'Threat Modeling', type: 'PREREQUISITE_OF' },
    { from: 'CIA Triad', to: 'Defense in Depth', type: 'PREREQUISITE_OF' },
    { from: 'Threat Modeling', to: 'Zero Trust', type: 'LEADS_TO' },
    { from: 'Authentication vs Authorization', to: 'Principle of Least Privilege', type: 'PREREQUISITE_OF' },
    { from: 'Principle of Least Privilege', to: 'Zero Trust', type: 'PREREQUISITE_OF' },
    { from: 'Defense in Depth', to: 'Zero Trust', type: 'RELATED_TO' },
    { from: 'Threat Modeling', to: 'SQL Injection', type: 'LEADS_TO' },
    { from: 'SQL Injection', to: 'Cross-Site Scripting', type: 'RELATED_TO' },
    { from: 'Authentication vs Authorization', to: 'Cryptographic Hashing', type: 'RELATED_TO' },
  ],
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-data/cybersecurity.ts
git commit -m "feat(seed): add cybersecurity course content"
```

---

## Task 4: AI Agents course content

**Files:**
- Create: `prisma/seed-data/ai-agents.ts`

- [ ] **Step 1: Create the file**

```ts
import type { SeedCourse } from './types'

export const aiAgents: SeedCourse = {
  slug: 'ai-agents',
  title: 'Building AI Agents',
  description:
    'Move from single prompts to systems that plan, call tools, remember, and recover from failure.',
  category: 'Artificial Intelligence',
  difficulty: 'INTERMEDIATE',
  estimatedHours: 12,
  modules: [
    {
      title: 'Agent Architecture',
      description: 'The loop, the tools, and the state that make an agent more than a prompt.',
      topics: [
        {
          title: 'The Agent Loop',
          description: 'Perceive, decide, act, observe — repeat until done.',
          concepts: [
            {
              name: 'ReAct Pattern',
              definition:
                'An agent loop that interleaves explicit reasoning traces with tool actions, feeding each observation back into the next reasoning step.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Trace one full reason-act-observe cycle',
                'Explain why observations must re-enter the context',
              ],
            },
            {
              name: 'Tool Calling',
              definition:
                'Exposing typed functions to a model so it can request their execution with structured arguments, with results returned into the conversation.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Write a tool schema a model can reliably target',
                'Explain why tool arguments must be validated before execution',
              ],
            },
            {
              name: 'Agent Memory',
              definition:
                'State an agent carries across steps or sessions — short-term scratchpad, long-term retrievable facts, or episodic interaction history.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Distinguish short-term from long-term memory',
                'Explain why unbounded history breaks the context window',
              ],
            },
          ],
        },
        {
          title: 'Planning and Control',
          description: 'Decomposing goals and keeping the loop from running away.',
          concepts: [
            {
              name: 'Task Decomposition',
              definition:
                'Breaking a goal into ordered subtasks the agent can verify individually, rather than attempting the whole goal in one step.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Decompose a vague goal into verifiable subtasks',
                'Explain why each subtask needs its own success check',
              ],
            },
            {
              name: 'Reflection',
              definition:
                'An agent evaluating its own output against the goal and revising before producing a final answer.',
              difficulty: 'ADVANCED',
              objectives: [
                'Describe a self-critique step',
                'Explain when reflection stops paying for itself',
              ],
            },
            {
              name: 'Guardrails',
              definition:
                'Hard constraints outside the model — step limits, cost caps, allowed-tool lists, output validators — that bound agent behaviour deterministically.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Name three failure modes guardrails prevent',
                'Explain why prompt instructions are not guardrails',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Multi-Agent Systems',
      description: 'When one agent is not the right shape for the problem.',
      topics: [
        {
          title: 'Coordination',
          description: 'Splitting work across specialised agents without chaos.',
          concepts: [
            {
              name: 'Orchestrator-Worker Pattern',
              definition:
                'A coordinating agent that decomposes a goal, dispatches subtasks to specialised worker agents, and reconciles their results.',
              difficulty: 'ADVANCED',
              objectives: [
                'Identify work that benefits from parallel workers',
                'Explain why workers need non-overlapping scope',
              ],
            },
            {
              name: 'Agent Handoff',
              definition:
                'Transferring control and the necessary context from one agent to another so the receiving agent can continue without the full history.',
              difficulty: 'ADVANCED',
              objectives: [
                'Decide what context must survive a handoff',
                'Explain the cost of over-transferring context',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'ReAct Pattern', to: 'Tool Calling', type: 'PREREQUISITE_OF' },
    { from: 'Tool Calling', to: 'Agent Memory', type: 'RELATED_TO' },
    { from: 'ReAct Pattern', to: 'Task Decomposition', type: 'LEADS_TO' },
    { from: 'Task Decomposition', to: 'Reflection', type: 'LEADS_TO' },
    { from: 'Tool Calling', to: 'Guardrails', type: 'PREREQUISITE_OF' },
    { from: 'Agent Memory', to: 'Agent Handoff', type: 'PREREQUISITE_OF' },
    { from: 'Task Decomposition', to: 'Orchestrator-Worker Pattern', type: 'PREREQUISITE_OF' },
    { from: 'Orchestrator-Worker Pattern', to: 'Agent Handoff', type: 'LEADS_TO' },
    { from: 'Guardrails', to: 'Orchestrator-Worker Pattern', type: 'RELATED_TO' },
  ],
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-data/ai-agents.ts
git commit -m "feat(seed): add ai agents course content"
```

---

## Task 5: Seed runner

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Create the file**

The script is idempotent: it deletes each course by slug before reinserting, so repeated runs converge rather than duplicate. Relationships are resolved after all concepts exist, by name within the course.

```ts
import { PrismaClient } from '../app/generated/prisma/client'
import type { SeedCourse } from './seed-data/types'
import { generativeAi } from './seed-data/generative-ai'
import { cybersecurity } from './seed-data/cybersecurity'
import { aiAgents } from './seed-data/ai-agents'

const prisma = new PrismaClient()

const COURSES: SeedCourse[] = [generativeAi, cybersecurity, aiAgents]

async function seedCourse(seed: SeedCourse) {
  await prisma.course.deleteMany({ where: { slug: seed.slug } })

  const course = await prisma.course.create({
    data: {
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      difficulty: seed.difficulty,
      estimatedHours: seed.estimatedHours,
      published: true,
    },
  })

  const conceptIdByName = new Map<string, string>()

  for (const [moduleIndex, seedModule] of seed.modules.entries()) {
    const createdModule = await prisma.module.create({
      data: {
        courseId: course.id,
        title: seedModule.title,
        description: seedModule.description,
        order: moduleIndex,
      },
    })

    for (const [topicIndex, seedTopic] of seedModule.topics.entries()) {
      const createdTopic = await prisma.topic.create({
        data: {
          moduleId: createdModule.id,
          title: seedTopic.title,
          description: seedTopic.description,
          order: topicIndex,
        },
      })

      for (const [conceptIndex, seedConcept] of seedTopic.concepts.entries()) {
        const createdConcept = await prisma.concept.create({
          data: {
            courseId: course.id,
            moduleId: createdModule.id,
            topicId: createdTopic.id,
            name: seedConcept.name,
            definition: seedConcept.definition,
            difficulty: seedConcept.difficulty,
            objectives: JSON.stringify(seedConcept.objectives),
            order: conceptIndex,
          },
        })
        conceptIdByName.set(seedConcept.name, createdConcept.id)
      }
    }
  }

  for (const rel of seed.relationships) {
    const fromId = conceptIdByName.get(rel.from)
    const toId = conceptIdByName.get(rel.to)
    if (!fromId || !toId) {
      throw new Error(
        `[${seed.slug}] relationship references unknown concept: ${rel.from} -> ${rel.to}`,
      )
    }
    await prisma.conceptRelationship.create({
      data: { fromId, toId, type: rel.type },
    })
  }

  const conceptCount = conceptIdByName.size
  console.log(
    `seeded ${seed.slug}: ${seed.modules.length} modules, ${conceptCount} concepts, ${seed.relationships.length} relationships`,
  )
}

async function main() {
  for (const course of COURSES) {
    await seedCourse(course)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected three lines:

```
seeded generative-ai: 2 modules, 11 concepts, 11 relationships
seeded cybersecurity-essentials: 2 modules, 9 concepts, 9 relationships
seeded ai-agents: 2 modules, 8 concepts, 9 relationships
```

- [ ] **Step 3: Run it again to prove idempotency**

Run: `npm run db:seed`
Expected: identical output, no unique-constraint errors.

- [ ] **Step 4: Verify the row counts**

Run: `npx prisma db execute --stdin <<< "SELECT (SELECT COUNT(*) FROM Course) AS courses, (SELECT COUNT(*) FROM Concept) AS concepts, (SELECT COUNT(*) FROM ConceptRelationship) AS rels;"`
Expected: `courses = 3`, `concepts = 28`, `rels = 29`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add idempotent seed runner for three courses"
```

---

## Task 6: Course repository

**Files:**
- Create: `lib/repositories/course.ts`
- Test: `tests/repositories/course.test.ts`

This test hits the real seeded SQLite file. That is deliberate — it catches schema drift that a mocked test would not.

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/course.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findCourseBySlug, listCourses } from '@/lib/repositories/course'

describe('listCourses', () => {
  it('returns all seeded published courses', async () => {
    const courses = await listCourses({})
    expect(courses).toHaveLength(3)
  })

  it('includes derived module and concept counts', async () => {
    const courses = await listCourses({})
    const genAi = courses.find((c) => c.slug === 'generative-ai')
    expect(genAi?.moduleCount).toBe(2)
    expect(genAi?.conceptCount).toBe(11)
  })

  it('filters by category', async () => {
    const courses = await listCourses({ category: 'Security' })
    expect(courses.map((c) => c.slug)).toEqual(['cybersecurity-essentials'])
  })

  it('filters by difficulty', async () => {
    const courses = await listCourses({ difficulty: 'INTERMEDIATE' })
    expect(courses.map((c) => c.slug)).toEqual(['ai-agents'])
  })

  it('returns an empty array when nothing matches', async () => {
    const courses = await listCourses({ category: 'Underwater Basket Weaving' })
    expect(courses).toEqual([])
  })
})

describe('findCourseBySlug', () => {
  it('returns the course with nested modules and topics', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course).not.toBeNull()
    expect(course!.title).toBe('Generative AI Foundations')
    expect(course!.modules).toHaveLength(2)
    expect(course!.modules[0].topics).toHaveLength(2)
  })

  it('orders modules and topics by their order column', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course!.modules.map((m) => m.order)).toEqual([0, 1])
    expect(course!.modules[0].topics.map((t) => t.order)).toEqual([0, 1])
  })

  it('includes a concept count on each topic', async () => {
    const course = await findCourseBySlug('generative-ai')
    expect(course!.modules[0].topics[0].conceptCount).toBe(3)
  })

  it('returns null for an unknown slug', async () => {
    await expect(findCourseBySlug('does-not-exist')).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/course.test.ts`
Expected: FAIL — `Cannot find module '@/lib/repositories/course'`.

- [ ] **Step 3: Create `lib/repositories/course.ts`**

```ts
import prisma from '@/lib/prisma'
import type { CourseDetail, CourseSummary } from '@/lib/schemas/course'
import type { Difficulty } from '@/lib/schemas/common'

export type CourseListFilters = {
  category?: string
  difficulty?: Difficulty
}

export async function listCourses(
  filters: CourseListFilters,
): Promise<CourseSummary[]> {
  const rows = await prisma.course.findMany({
    where: {
      published: true,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    },
    orderBy: { title: 'asc' },
    include: {
      _count: { select: { modules: true, concepts: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    estimatedHours: row.estimatedHours,
    moduleCount: row._count.modules,
    conceptCount: row._count.concepts,
  }))
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.course.findMany({
    where: { published: true },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return rows.map((r) => r.category)
}

export async function findCourseBySlug(
  slug: string,
): Promise<CourseDetail | null> {
  const row = await prisma.course.findUnique({
    where: { slug },
    include: {
      _count: { select: { modules: true, concepts: true } },
      modules: {
        orderBy: { order: 'asc' },
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: { _count: { select: { concepts: true } } },
          },
        },
      },
    },
  })

  if (!row) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    estimatedHours: row.estimatedHours,
    moduleCount: row._count.modules,
    conceptCount: row._count.concepts,
    modules: row.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      topics: m.topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        order: t.order,
        conceptCount: t._count.concepts,
      })),
    })),
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/course.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/course.ts tests/repositories/course.test.ts
git commit -m "feat(courses): add course repository with list, detail and categories"
```

---

## Task 7: Course list API

**Files:**
- Create: `app/api/courses/route.ts`
- Test: `tests/api/courses.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/courses.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/route'

function get(url: string) {
  return GET(new Request(url))
}

describe('GET /api/courses', () => {
  it('returns all courses in a data envelope', async () => {
    const res = await get('http://localhost/api/courses')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
  })

  it('filters by the category query param', async () => {
    const res = await get('http://localhost/api/courses?category=Security')
    const body = await res.json()
    expect(body.data.map((c: { slug: string }) => c.slug)).toEqual([
      'cybersecurity-essentials',
    ])
  })

  it('filters by the difficulty query param', async () => {
    const res = await get('http://localhost/api/courses?difficulty=INTERMEDIATE')
    const body = await res.json()
    expect(body.data.map((c: { slug: string }) => c.slug)).toEqual(['ai-agents'])
  })

  it('rejects an invalid difficulty with 400', async () => {
    const res = await get('http://localhost/api/courses?difficulty=EXPERT')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/courses.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/courses/route'`.

- [ ] **Step 3: Create `app/api/courses/route.ts`**

```ts
import { z } from 'zod'
import { ApiError, handle, ok } from '@/lib/api'
import { difficultySchema } from '@/lib/schemas/common'
import { listCourses } from '@/lib/repositories/course'

const querySchema = z.object({
  category: z.string().min(1).optional(),
  difficulty: difficultySchema.optional(),
})

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams
    const raw = {
      category: params.get('category') ?? undefined,
      difficulty: params.get('difficulty') ?? undefined,
    }

    const parsed = querySchema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ApiError(
        'VALIDATION_ERROR',
        `${issue.path.join('.')}: ${issue.message}`,
        400,
      )
    }

    const courses = await listCourses(parsed.data)
    return ok(courses)
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/api/courses.test.ts`
Expected: PASS — `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/courses/route.ts tests/api/courses.test.ts
git commit -m "feat(api): add GET /api/courses with category and difficulty filters"
```

---

## Task 8: Course detail API

**Files:**
- Create: `app/api/courses/[slug]/route.ts`
- Test: `tests/api/course-detail.test.ts`

Note the `params` Promise — Next.js 15+ requires awaiting it.

- [ ] **Step 1: Write the failing test**

Create `tests/api/course-detail.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/courses/[slug]/route'

function get(slug: string) {
  return GET(new Request(`http://localhost/api/courses/${slug}`), {
    params: Promise.resolve({ slug }),
  })
}

describe('GET /api/courses/[slug]', () => {
  it('returns the course detail for a known slug', async () => {
    const res = await get('generative-ai')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Generative AI Foundations')
    expect(body.data.modules).toHaveLength(2)
  })

  it('nests topics inside modules', async () => {
    const res = await get('generative-ai')
    const body = await res.json()
    expect(body.data.modules[0].topics[0].title).toBe('Text Representation')
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await get('nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/course-detail.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/courses/[slug]/route'`.

- [ ] **Step 3: Create `app/api/courses/[slug]/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import { findCourseBySlug } from '@/lib/repositories/course'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(async () => {
    const { slug } = await params
    const course = await findCourseBySlug(slug)
    if (!course) {
      throw new ApiError('NOT_FOUND', `No course with slug "${slug}"`, 404)
    }
    return ok(course)
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/api/course-detail.test.ts`
Expected: PASS — `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/courses/[slug]/route.ts" tests/api/course-detail.test.ts
git commit -m "feat(api): add GET /api/courses/[slug] course detail endpoint"
```

---

## Task 9: Course card component

**Files:**
- Create: `components/difficulty-badge.tsx`
- Create: `components/course-card.tsx`
- Test: `tests/components/course-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/course-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseCard } from '@/components/course-card'
import type { CourseSummary } from '@/lib/schemas/course'

const course: CourseSummary = {
  id: 'c1',
  slug: 'generative-ai',
  title: 'Generative AI Foundations',
  description: 'Understand how modern language models work.',
  category: 'Artificial Intelligence',
  difficulty: 'BEGINNER',
  estimatedHours: 8,
  moduleCount: 2,
  conceptCount: 11,
}

describe('CourseCard', () => {
  it('renders the title and description', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('Generative AI Foundations')).toBeInTheDocument()
    expect(
      screen.getByText('Understand how modern language models work.'),
    ).toBeInTheDocument()
  })

  it('renders the difficulty badge', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('Beginner')).toBeInTheDocument()
  })

  it('renders module, concept and hour counts', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('2 modules')).toBeInTheDocument()
    expect(screen.getByText('11 concepts')).toBeInTheDocument()
    expect(screen.getByText('8h')).toBeInTheDocument()
  })

  it('links to the course detail page', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/courses/generative-ai',
    )
  })

  it('singularises a one-module course', () => {
    render(<CourseCard course={{ ...course, moduleCount: 1 }} />)
    expect(screen.getByText('1 module')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/course-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/course-card'`.

- [ ] **Step 3: Create `components/difficulty-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import type { Difficulty } from '@/lib/schemas/common'

const LABEL: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

const VARIANT: Record<Difficulty, 'secondary' | 'default' | 'destructive'> = {
  BEGINNER: 'secondary',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge variant={VARIANT[difficulty]}>{LABEL[difficulty]}</Badge>
}
```

- [ ] **Step 4: Create `components/course-card.tsx`**

```tsx
import Link from 'next/link'
import { Clock, Layers, Network } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { CourseSummary } from '@/lib/schemas/course'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="leading-snug">{course.title}</CardTitle>
            <DifficultyBadge difficulty={course.difficulty} />
          </div>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {course.category}
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers data-icon className="size-4" />
            {plural(course.moduleCount, 'module')}
          </span>
          <span className="flex items-center gap-1.5">
            <Network data-icon className="size-4" />
            {plural(course.conceptCount, 'concept')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock data-icon className="size-4" />
            {course.estimatedHours}h
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/course-card.test.tsx`
Expected: PASS — `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/difficulty-badge.tsx components/course-card.tsx tests/components/course-card.test.tsx
git commit -m "feat(ui): add course card and difficulty badge"
```

---

## Task 10: Filter bar

**Files:**
- Create: `components/course-filters.tsx`
- Test: `tests/components/course-filters.test.tsx`

Filters live in the URL so the page stays a Server Component and the state survives a refresh.

- [ ] **Step 1: Write the failing test**

Create `tests/components/course-filters.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CourseFilters } from '@/components/course-filters'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/explore',
  useSearchParams: () => new URLSearchParams(''),
}))

describe('CourseFilters', () => {
  it('renders an All chip plus one chip per category', () => {
    render(<CourseFilters categories={['Security', 'Artificial Intelligence']} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Security' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Artificial Intelligence' }),
    ).toBeInTheDocument()
  })

  it('renders the three difficulty chips', () => {
    render(<CourseFilters categories={[]} />)
    expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intermediate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('pushes the selected category into the url', async () => {
    const user = userEvent.setup()
    render(<CourseFilters categories={['Security']} />)
    await user.click(screen.getByRole('button', { name: 'Security' }))
    expect(replace).toHaveBeenCalledWith('/explore?category=Security', {
      scroll: false,
    })
  })

  it('pushes the selected difficulty into the url', async () => {
    const user = userEvent.setup()
    render(<CourseFilters categories={[]} />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(replace).toHaveBeenCalledWith('/explore?difficulty=ADVANCED', {
      scroll: false,
    })
  })
})
```

- [ ] **Step 2: Install the interaction testing library**

Run: `npm install -D @testing-library/user-event`

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test tests/components/course-filters.test.tsx`
Expected: FAIL — `Cannot find module '@/components/course-filters'`.

- [ ] **Step 4: Create `components/course-filters.tsx`**

```tsx
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Difficulty } from '@/lib/schemas/common'

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
]

export function CourseFilters({ categories }: { categories: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCategory = searchParams.get('category')
  const activeDifficulty = searchParams.get('difficulty')

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === null || next.get(key) === value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={activeCategory ? 'ghost' : 'secondary'}
        size="sm"
        onClick={() => setParam('category', null)}
      >
        All
      </Button>

      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setParam('category', category)}
        >
          {category}
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {DIFFICULTIES.map((d) => (
        <Button
          key={d.value}
          variant={activeDifficulty === d.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setParam('difficulty', d.value)}
        >
          {d.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/course-filters.test.tsx`
Expected: PASS — `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/course-filters.tsx tests/components/course-filters.test.tsx package.json package-lock.json
git commit -m "feat(ui): add url-driven course filter bar"
```

---

## Task 11: Explore page

**Files:**
- Create: `app/explore/page.tsx`
- Create: `app/explore/loading.tsx`

The page is a Server Component calling the repository directly — no HTTP round-trip to our own API.

- [ ] **Step 1: Create `app/explore/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/explore/page.tsx`**

```tsx
import { Compass } from 'lucide-react'
import { CourseCard } from '@/components/course-card'
import { CourseFilters } from '@/components/course-filters'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { listCategories, listCourses } from '@/lib/repositories/course'
import { difficultySchema } from '@/lib/schemas/common'

export const metadata = {
  title: 'Explore courses — Adaptive',
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; difficulty?: string }>
}) {
  const { category, difficulty } = await searchParams

  const parsedDifficulty = difficultySchema.safeParse(difficulty)

  const [courses, categories] = await Promise.all([
    listCourses({
      category,
      difficulty: parsedDifficulty.success ? parsedDifficulty.data : undefined,
    }),
    listCategories(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Explore courses</h1>
        <p className="text-sm text-muted-foreground">
          Pick a subject. The tutor adapts to what you already understand.
        </p>
      </header>

      <CourseFilters categories={categories} />

      {courses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Compass data-icon />
            </EmptyMedia>
            <EmptyTitle>No courses match those filters</EmptyTitle>
            <EmptyDescription>
              Clear a filter to widen the search.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Look at it**

Run: `npm run dev` and open `http://localhost:3000/explore`.
Expected: three course cards in a responsive grid. Clicking **Security** narrows to one card and puts `?category=Security` in the URL. Clicking it again clears the filter. Clicking **Advanced** shows the empty state.

- [ ] **Step 4: Commit**

```bash
git add app/explore
git commit -m "feat(ui): add explore page with filters, grid and empty state"
```

---

## Task 12: Course detail page

**Files:**
- Create: `app/courses/[slug]/page.tsx`
- Create: `app/courses/[slug]/not-found.tsx`

- [ ] **Step 1: Create `app/courses/[slug]/not-found.tsx`**

```tsx
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function CourseNotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX data-icon />
        </EmptyMedia>
        <EmptyTitle>Course not found</EmptyTitle>
        <EmptyDescription>
          That course does not exist, or it has not been published yet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/explore" />}>Back to explore</Button>
      </EmptyContent>
    </Empty>
  )
}
```

- [ ] **Step 2: Create `app/courses/[slug]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Layers, Network } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { findCourseBySlug } from '@/lib/repositories/course'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return { title: course ? `${course.title} — Adaptive` : 'Course — Adaptive' }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)

  if (!course) notFound()

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{course.category}</Badge>
          <DifficultyBadge difficulty={course.difficulty} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{course.description}</p>
        <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers data-icon className="size-4" />
            {course.moduleCount} modules
          </span>
          <span className="flex items-center gap-1.5">
            <Network data-icon className="size-4" />
            {course.conceptCount} concepts
          </span>
          <span className="flex items-center gap-1.5">
            <Clock data-icon className="size-4" />
            {course.estimatedHours} hours
          </span>
        </div>
      </header>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Curriculum</h2>
        {course.modules.map((module, index) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-3 text-base">
                <span className="text-sm font-mono text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {module.title}
              </CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {module.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{topic.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {topic.description}
                    </span>
                  </div>
                  <Badge variant="secondary">{topic.conceptCount} concepts</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Look at it**

Run: `npm run dev`, open `/explore`, click **Generative AI Foundations**.
Expected: breadcrumb, title, badges, three stat items, then two module cards each listing their topics with concept counts. Visiting `/courses/not-real` shows the not-found empty state.

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0, `25 passed` or more across the new test files.

- [ ] **Step 5: Commit**

```bash
git add "app/courses"
git commit -m "feat(ui): add course detail page with curriculum breakdown"
```

---

## Phase 1 Exit Checklist

- [ ] `npm run db:seed` is idempotent and reports 3 courses, 28 concepts, 29 relationships
- [ ] `GET /api/courses` returns 3 courses; filters work; bad difficulty returns 400
- [ ] `GET /api/courses/generative-ai` returns nested modules and topics; unknown slug returns 404
- [ ] `/explore` renders the grid, filters update the URL, empty state appears when nothing matches
- [ ] `/courses/generative-ai` renders the full curriculum
- [ ] `/courses/not-real` renders the not-found state
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-02-concept-map.md`](./phase-02-concept-map.md).
