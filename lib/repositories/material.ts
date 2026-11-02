import prisma from '@/lib/prisma'
import type { MaterialSummary } from '@/lib/schemas/material'
import type { Chunk } from '@/lib/text/retrieve'
import { embedBatch } from '@/lib/text/embed'

function toSummary(row: {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  status: string
  error: string | null
  createdAt: Date
  suggestions?: string
  _count: { chunks: number }
}): MaterialSummary {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status as MaterialSummary['status'],
    chunkCount: row._count.chunks,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    suggestions: row.suggestions ?? '',
  }
}

export async function createMaterial(input: {
  userId: string
  filename: string
  mimeType: string
  sizeBytes: number
  courseId?: string | null
}): Promise<MaterialSummary> {
  const row = await prisma.material.create({
    data: {
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      courseId: input.courseId ?? null,
      status: 'UPLOADED',
    },
    include: { _count: { select: { chunks: true } } },
  })
  return toSummary(row)
}

export async function storeChunks(
  materialId: string,
  contents: string[],
): Promise<void> {
  // Embedding failure must not lose the document — keyword search still
  // works without vectors, so degrade instead of throwing.
  let vectors: number[][] = []
  try {
    vectors = await embedBatch(contents)
  } catch (error) {
    console.error('Embedding failed, storing chunks without vectors:', error)
  }

  await prisma.$transaction([
    prisma.materialChunk.deleteMany({ where: { materialId } }),
    prisma.materialChunk.createMany({
      data: contents.map((content, order) => ({
        materialId,
        content,
        order,
        tokenCount: Math.ceil(content.length / 4),
        embedding: vectors[order] ? JSON.stringify(vectors[order]) : '',
      })),
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { status: 'READY', error: null },
    }),
  ])
}

export async function markFailed(
  materialId: string,
  reason: string,
): Promise<void> {
  await prisma.material.update({
    where: { id: materialId },
    data: { status: 'FAILED', error: reason },
  })
}

export async function findMaterial(
  id: string,
): Promise<MaterialSummary | null> {
  const row = await prisma.material.findUnique({
    where: { id },
    include: { _count: { select: { chunks: true } } },
  })
  return row ? toSummary(row) : null
}

export async function listMaterials(
  userId: string,
): Promise<MaterialSummary[]> {
  const rows = await prisma.material.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  })
  return rows.map(toSummary)
}

export async function getChunks(materialId: string): Promise<Chunk[]> {
  const rows = await prisma.materialChunk.findMany({
    where: { materialId },
    orderBy: { order: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    order: row.order,
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
  }))
}

export async function saveSuggestions(
  materialId: string,
  questions: string[],
): Promise<void> {
  await prisma.material.update({
    where: { id: materialId },
    data: { suggestions: JSON.stringify(questions) },
  })
}

export async function deleteMaterial(id: string): Promise<void> {
  await prisma.material.delete({ where: { id } })
}
