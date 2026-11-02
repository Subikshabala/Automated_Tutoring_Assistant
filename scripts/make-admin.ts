import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { role: 'ADMIN' },
    select: { email: true, role: true },
  })

  console.log(`${user.email} is now ${user.role}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
