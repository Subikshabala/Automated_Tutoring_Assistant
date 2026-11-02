import prisma from '@/lib/prisma'
import { ApiError } from '@/lib/api'
import { canTransition, type SourceStatus } from '@/lib/schemas/source'

export type SourceRow = {
  id: string
  courseId: string | null
  topicId: string | null
  title: string
  url: string | null
  publisher: string | null
  authorityLevel: number
  publicationDate: Date | null
  version: string | null
  status: SourceStatus
  lastVerifiedAt: Date | null
  createdAt: Date
  courseName: string | null
}

export type CreateSourceInput = {
  courseId?: string | null
  topicId?: string | null
  title: string
  url?: string | null
  publisher?: string | null
  authorityLevel: number
  publicationDate?: string | null
  version?: string | null
}

export async function listSources(filters?: {
  courseId?: string
  status?: SourceStatus
}): Promise<SourceRow[]> {
  const where: Record<string, unknown> = {}
  if (filters?.courseId) where.courseId = filters.courseId
  if (filters?.status) where.status = filters.status

  const rows = await prisma.source.findMany({
    where,
    include: {
      course: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    topicId: row.topicId,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    authorityLevel: row.authorityLevel,
    publicationDate: row.publicationDate,
    version: row.version,
    status: row.status as SourceStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    courseName: row.course?.title ?? null,
  }))
}

export async function createSource(input: CreateSourceInput): Promise<SourceRow> {
  const row = await prisma.source.create({
    data: {
      courseId: input.courseId ?? null,
      topicId: input.topicId ?? null,
      title: input.title,
      url: input.url ?? null,
      publisher: input.publisher ?? null,
      authorityLevel: input.authorityLevel,
      publicationDate: input.publicationDate
        ? new Date(input.publicationDate)
        : null,
      version: input.version ?? null,
      status: 'DRAFT',
    },
    include: {
      course: { select: { title: true } },
    },
  })

  return {
    id: row.id,
    courseId: row.courseId,
    topicId: row.topicId,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    authorityLevel: row.authorityLevel,
    publicationDate: row.publicationDate,
    version: row.version,
    status: row.status as SourceStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    courseName: row.course?.title ?? null,
  }
}

export async function transitionSourceStatus(
  id: string,
  newStatus: SourceStatus,
): Promise<SourceRow> {
  const existing = await prisma.source.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('NOT_FOUND', 'Source not found', 404)
  }

  const currentStatus = existing.status as SourceStatus
  if (!canTransition(currentStatus, newStatus)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      400,
    )
  }

  const row = await prisma.source.update({
    where: { id },
    data: { status: newStatus },
    include: {
      course: { select: { title: true } },
    },
  })

  return {
    id: row.id,
    courseId: row.courseId,
    topicId: row.topicId,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    authorityLevel: row.authorityLevel,
    publicationDate: row.publicationDate,
    version: row.version,
    status: row.status as SourceStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    courseName: row.course?.title ?? null,
  }
}

export async function deleteSource(id: string): Promise<void> {
  const existing = await prisma.source.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('NOT_FOUND', 'Source not found', 404)
  }
  if (existing.status !== 'DRAFT') {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Only draft sources can be deleted',
      400,
    )
  }
  await prisma.source.delete({ where: { id } })
}
