import prisma from '@/lib/prisma'
import { ApiError } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { readStringArray, writeStringArray } from '@/lib/json-array'
import type { RegisterInput, SessionUser } from '@/lib/schemas/auth'

export async function createUser(
  input: RegisterInput,
): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (existing) {
    throw new ApiError(
      'EMAIL_TAKEN',
      'An account with that email already exists',
      409,
    )
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true, name: true, role: true },
  })

  return user
}

export async function findUserByEmail(
  email: string,
): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  })
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const row = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })
  if (!row) return null

  const valid = await verifyPassword(password, row.passwordHash)
  if (!valid) return null

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  }
}

export async function hasTakenDiagnostic(
  userId: string,
  courseSlug: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { diagnosedCourses: true },
  })
  return readStringArray(user?.diagnosedCourses).includes(courseSlug)
}

export async function markDiagnosticTaken(
  userId: string,
  courseSlug: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { diagnosedCourses: true },
  })
  const current = readStringArray(user.diagnosedCourses)
  if (current.includes(courseSlug)) return

  await prisma.user.update({
    where: { id: userId },
    data: { diagnosedCourses: writeStringArray([...current, courseSlug]) },
  })
}
