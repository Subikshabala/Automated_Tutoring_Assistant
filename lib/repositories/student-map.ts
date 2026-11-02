import prisma from '@/lib/prisma'
import { ApiError } from '@/lib/api'
import type { SaveMapInput } from '@/lib/schemas/student-map'
import type { RelationshipType } from '@/lib/schemas/concept'

export type StoredMap = {
  id: string
  courseSlug: string
  title: string
  updatedAt: string
  nodes: { id: string; label: string; x: number; y: number }[]
  edges: { id: string; fromId: string; toId: string; type: RelationshipType }[]
}

async function load(id: string): Promise<StoredMap | null> {
  const row = await prisma.conceptMap.findUnique({
    where: { id },
    include: {
      course: { select: { slug: true } },
      nodes: true,
      edges: true,
    },
  })
  if (!row) return null

  return {
    id: row.id,
    courseSlug: row.course.slug,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    nodes: row.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      x: n.x,
      y: n.y,
    })),
    edges: row.edges.map((e) => ({
      id: e.id,
      fromId: e.fromId,
      toId: e.toId,
      type: e.type,
    })),
  }
}

export async function saveStudentMap(
  userId: string,
  input: SaveMapInput,
): Promise<StoredMap> {
  const course = await prisma.course.findUnique({
    where: { slug: input.courseSlug },
    select: { id: true },
  })
  if (!course) {
    throw new ApiError(
      'NOT_FOUND',
      `No course with slug "${input.courseSlug}"`,
      404,
    )
  }

  const mapId = await prisma.$transaction(async (tx) => {
    let id = input.id

    if (id) {
      const existing = await tx.conceptMap.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!existing) {
        throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
      }
      await tx.conceptMap.update({
        where: { id },
        data: { title: input.title },
      })
      await tx.conceptMapEdge.deleteMany({ where: { mapId: id } })
      await tx.conceptMapNode.deleteMany({ where: { mapId: id } })
    } else {
      const created = await tx.conceptMap.create({
        data: { userId, courseId: course.id, title: input.title },
      })
      id = created.id
    }

    // Client ids are not stable; map them to the ids the database assigns.
    const dbIdByClientId = new Map<string, string>()
    for (const node of input.nodes) {
      const created = await tx.conceptMapNode.create({
        data: { mapId: id, label: node.label, x: node.x, y: node.y },
      })
      dbIdByClientId.set(node.id, created.id)
    }

    for (const edge of input.edges) {
      const fromId = dbIdByClientId.get(edge.fromId)
      const toId = dbIdByClientId.get(edge.toId)
      if (!fromId || !toId) continue
      await tx.conceptMapEdge.create({
        data: { mapId: id, fromId, toId, type: edge.type },
      })
    }

    return id
  })

  const saved = await load(mapId)
  if (!saved) throw new Error('Map vanished immediately after save')
  return saved
}

export async function findStudentMap(id: string): Promise<StoredMap | null> {
  return load(id)
}

export async function listStudentMaps(
  userId: string,
  courseSlug: string,
): Promise<StoredMap[]> {
  const rows = await prisma.conceptMap.findMany({
    where: { userId, course: { slug: courseSlug } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  const maps: StoredMap[] = []
  for (const row of rows) {
    const map = await load(row.id)
    if (map) maps.push(map)
  }
  return maps
}

export type StudentMapSummary = {
  id: string
  courseSlug: string
  courseTitle: string
  title: string
  nodeCount: number
  edgeCount: number
  updatedAt: string
}

export async function listAllStudentMaps(
  userId: string,
): Promise<StudentMapSummary[]> {
  const rows = await prisma.conceptMap.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      course: { select: { slug: true, title: true } },
      _count: { select: { nodes: true, edges: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    courseSlug: row.course.slug,
    courseTitle: row.course.title,
    title: row.title,
    nodeCount: row._count.nodes,
    edgeCount: row._count.edges,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function deleteStudentMap(id: string): Promise<void> {
  await prisma.conceptMap.delete({ where: { id } })
}
