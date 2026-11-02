import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { applyAttempt, masteryStatusFor, type MasteryState } from '../lib/mastery'
import { chunkText } from '../lib/text/chunk'
import { embedText } from '../lib/text/embed'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

const DEMO_EMAIL = 'demo@adaptive.local'
const DEMO_PASSWORD = 'demo-password-1234'

// ---------------------------------------------------------------------------
// Mastery plan
// ---------------------------------------------------------------------------

/**
 * A learner who understands the input pipeline but has not grasped
 * attention, and who holds one specific, nameable misconception.
 *
 * This shape is deliberate: it gives the adaptive engine something to
 * reason about and gives the Progress page a mix of situations.
 */
const MASTERY_PLAN: { concept: string; score: number; attempts: number }[] = [
  { concept: 'Tokenization', score: 92, attempts: 3 },
  { concept: 'Embeddings', score: 85, attempts: 2 },
  { concept: 'Context Window', score: 71, attempts: 2 },
  { concept: 'Attention', score: 38, attempts: 2 },
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

// ---------------------------------------------------------------------------
// Demo document (deliberately contradicts the misconception)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Saved concept map (partially correct — Compare has something to report)
// ---------------------------------------------------------------------------

const DEMO_MAP = {
  title: 'My first attempt',
  nodes: ['Tokenization', 'Embeddings', 'Attention', 'Prompt Engineering'],
  // Deliberately wrong: skips Embeddings between Tokenization and Attention.
  edges: [
    ['Tokenization', 'Attention'],
    ['Attention', 'Prompt Engineering'],
  ],
}

// ---------------------------------------------------------------------------
// recordAttempt (standalone — can't use @/ path alias from scripts)
// ---------------------------------------------------------------------------

async function recordAttempt(
  userId: string,
  conceptId: string,
  attemptScore: number,
): Promise<void> {
  const existing = await prisma.mastery.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })

  const previous: MasteryState = existing
    ? {
        masteryScore: existing.masteryScore,
        confidenceScore: existing.confidenceScore,
        attemptCount: existing.attemptCount,
        correctCount: existing.correctCount,
        incorrectCount: existing.incorrectCount,
      }
    : {
        masteryScore: 0,
        confidenceScore: 0,
        attemptCount: 0,
        correctCount: 0,
        incorrectCount: 0,
      }

  const next = applyAttempt(previous, attemptScore)
  const status = masteryStatusFor(next.masteryScore, next.attemptCount)
  const now = new Date()

  await prisma.mastery.upsert({
    where: { userId_conceptId: { userId, conceptId } },
    create: {
      userId,
      conceptId,
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
    update: {
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
  })
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

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
    console.log(`  mastery: ${plan.concept} → target ${plan.score}`)
  }
}

async function seedMisconception(userId: string) {
  const concept = await prisma.concept.findFirst({
    where: { name: MISCONCEPTION.concept },
  })
  if (!concept) {
    console.warn(`  skipping misconception — concept "${MISCONCEPTION.concept}" not found`)
    return
  }

  await prisma.misconception.create({
    data: {
      userId,
      conceptId: concept.id,
      description: MISCONCEPTION.description,
      evidence: MISCONCEPTION.evidence,
      resolved: false,
    },
  })
  console.log(`  misconception: ${MISCONCEPTION.concept}`)
}

async function seedSessions(userId: string) {
  const topics = await prisma.topic.findMany({
    where: { module: { course: { slug: 'generative-ai' } } },
    orderBy: { order: 'asc' },
    take: 2,
  })

  const now = Date.now()
  for (const [index, topic] of topics.entries()) {
    const startedAt = new Date(now - (index + 1) * 36e5)
    const mod = await prisma.module.findUniqueOrThrow({
      where: { id: topic.moduleId },
      select: { courseId: true },
    })
    await prisma.learningSession.create({
      data: {
        userId,
        topicId: topic.id,
        courseId: mod.courseId,
        startedAt,
        // Leave the most recent one open so Progress shows a resume card.
        endedAt: index === 0 ? null : new Date(startedAt.getTime() + 18e5),
      },
    })
  }
  console.log(`  sessions: ${topics.length} topics`)
}

async function seedProgress(userId: string) {
  // Mark the mastered concepts as having been viewed.
  const masteredConcepts = await prisma.mastery.findMany({
    where: { userId, masteryScore: { gte: 80 } },
    select: { conceptId: true },
  })

  for (const { conceptId } of masteredConcepts) {
    await prisma.learningProgress.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      create: {
        userId,
        conceptId,
        completed: true,
        timeSpentSec: 300 + Math.floor(Math.random() * 300),
        lastViewedAt: new Date(Date.now() - 3600_000),
      },
      update: {},
    })
  }
  console.log(`  progress: ${masteredConcepts.length} concepts viewed`)
}

async function seedMaterial(userId: string) {
  const chunks = chunkText(DEMO_DOC)
  const material = await prisma.material.create({
    data: {
      userId,
      filename: 'transformer-notes.md',
      mimeType: 'text/markdown',
      sizeBytes: Buffer.byteLength(DEMO_DOC, 'utf-8'),
      status: 'READY',
      suggestions: JSON.stringify([
        'What is self-attention?',
        'How does multi-head attention work?',
        'Why is positional encoding needed?',
      ]),
    },
  })

  console.log(`  material: ${chunks.length} chunks, embedding...`)
  for (const [i, text] of chunks.entries()) {
    const embedding = await embedText(text)
    await prisma.materialChunk.create({
      data: {
        materialId: material.id,
        content: text,
        tokenCount: text.split(/\s+/).length,
        order: i,
        embedding: JSON.stringify(embedding),
      },
    })
  }
  console.log(`  material: embedded ${chunks.length} chunks`)
}

async function seedConceptMap(userId: string) {
  const course = await prisma.course.findUnique({
    where: { slug: 'generative-ai' },
  })
  if (!course) {
    console.warn('  skipping concept map — course not found')
    return
  }

  const map = await prisma.conceptMap.create({
    data: {
      userId,
      courseId: course.id,
      title: DEMO_MAP.title,
    },
  })

  // Create nodes with grid positions
  const nodeIds = new Map<string, string>()
  for (const [i, label] of DEMO_MAP.nodes.entries()) {
    // Look up the real concept id if it exists
    const concept = await prisma.concept.findFirst({
      where: { name: label, courseId: course.id },
    })
    const node = await prisma.conceptMapNode.create({
      data: {
        mapId: map.id,
        label,
        conceptId: concept?.id ?? null,
        x: (i % 3) * 200 + 100,
        y: Math.floor(i / 3) * 200 + 100,
      },
    })
    nodeIds.set(label, node.id)
  }

  // Create edges
  for (const [from, to] of DEMO_MAP.edges) {
    const fromId = nodeIds.get(from)
    const toId = nodeIds.get(to)
    if (fromId && toId) {
      await prisma.conceptMapEdge.create({
        data: {
          mapId: map.id,
          fromId,
          toId,
          type: 'PREREQUISITE_OF',
        },
      })
    }
  }
  console.log(`  concept map: ${DEMO_MAP.nodes.length} nodes, ${DEMO_MAP.edges.length} edges`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding demo account...')

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Learner',
      passwordHash,
      diagnosedCourses: JSON.stringify(['generative-ai']),
    },
    update: {},
  })

  // Wipe prior demo data so repeat runs converge rather than accumulate.
  await prisma.mastery.deleteMany({ where: { userId: user.id } })
  await prisma.misconception.deleteMany({ where: { userId: user.id } })
  await prisma.learningSession.deleteMany({ where: { userId: user.id } })
  await prisma.learningProgress.deleteMany({ where: { userId: user.id } })

  // ConceptMapEdge and ConceptMapNode cascade from ConceptMap deletion.
  await prisma.conceptMap.deleteMany({ where: { userId: user.id } })

  // MaterialChunk cascades from Material deletion.
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

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
