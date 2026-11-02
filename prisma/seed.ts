import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { SeedCourse } from './seed-data/types'
import { generativeAi } from './seed-data/generative-ai'
import { cybersecurity } from './seed-data/cybersecurity'
import { aiAgents } from './seed-data/ai-agents'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

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
