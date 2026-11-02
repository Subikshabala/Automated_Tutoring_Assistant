import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { embedBatch } from '../lib/text/embed'
import path from 'node:path'

const adapter = new PrismaLibSql({
  url: `file:${path.resolve(process.cwd(), 'dev.db')}`,
})
const prisma = new PrismaClient({ adapter })

const BATCH = 16

async function main() {
  const pending = await prisma.materialChunk.findMany({
    where: { embedding: '' },
    select: { id: true, content: true },
  })

  if (pending.length === 0) {
    console.log('Every chunk already has an embedding.')
    return
  }

  console.log(`Embedding ${pending.length} chunks...`)

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH)
    const vectors = await embedBatch(slice.map((c) => c.content))

    await prisma.$transaction(
      slice.map((chunk, j) =>
        prisma.materialChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(vectors[j]) },
        }),
      ),
    )

    console.log(`  ${Math.min(i + BATCH, pending.length)}/${pending.length}`)
  }

  console.log('Done.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
