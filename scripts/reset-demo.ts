/**
 * Drops all learner data but keeps courses and concepts, then reseeds
 * the demo account. Faster than a full migrate reset and does not need
 * the embedding backfill to run again.
 */

import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'
import { execSync } from 'node:child_process'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Resetting learner data...\n')

  // Delete in dependency order to avoid FK violations.
  await prisma.answer.deleteMany()
  console.log('  cleared Answer')

  await prisma.question.deleteMany()
  console.log('  cleared Question')

  await prisma.assessment.deleteMany()
  console.log('  cleared Assessment')

  await prisma.mastery.deleteMany()
  console.log('  cleared Mastery')

  await prisma.misconception.deleteMany()
  console.log('  cleared Misconception')

  await prisma.learningProgress.deleteMany()
  console.log('  cleared LearningProgress')

  await prisma.learningSession.deleteMany()
  console.log('  cleared LearningSession')

  // ConceptMapEdge and ConceptMapNode cascade from ConceptMap,
  // but delete them explicitly to be safe.
  await prisma.conceptMapEdge.deleteMany()
  console.log('  cleared ConceptMapEdge')

  await prisma.conceptMapNode.deleteMany()
  console.log('  cleared ConceptMapNode')

  await prisma.conceptMap.deleteMany()
  console.log('  cleared ConceptMap')

  await prisma.materialChunk.deleteMany()
  console.log('  cleared MaterialChunk')

  await prisma.material.deleteMany()
  console.log('  cleared Material')

  // Delete non-admin users.
  await prisma.user.deleteMany({
    where: { role: { not: 'ADMIN' } },
  })
  console.log('  cleared non-admin Users')

  await prisma.$disconnect()

  console.log('\nRe-seeding demo account...\n')
  execSync('npx tsx scripts/seed-demo.ts', { stdio: 'inherit' })
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
