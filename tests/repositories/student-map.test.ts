import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  deleteStudentMap,
  findStudentMap,
  listAllStudentMaps,
  listStudentMaps,
  saveStudentMap,
} from '@/lib/repositories/student-map'

async function testUser() {
  return prisma.user.upsert({
    where: { email: 'repo-test@example.com' },
    create: {
      email: 'repo-test@example.com',
      passwordHash: 'unset',
      name: 'Repo Test',
    },
    update: {},
  })
}

const input = {
  courseSlug: 'generative-ai',
  title: 'My first attempt',
  nodes: [
    { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
    { id: 'n2', label: 'Embeddings', x: 200, y: 0 },
  ],
  edges: [
    { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' as const },
  ],
}

afterEach(async () => {
  const user = await testUser()
  await prisma.conceptMap.deleteMany({ where: { userId: user.id } })
})

describe('saveStudentMap', () => {
  it('creates a new map', async () => {
    const user = await testUser()
    const map = await saveStudentMap(user.id, input)
    expect(map.title).toBe('My first attempt')
    expect(map.nodes).toHaveLength(2)
    expect(map.edges).toHaveLength(1)
  })

  it('preserves node labels and positions', async () => {
    const user = await testUser()
    const map = await saveStudentMap(user.id, input)
    const embeddings = map.nodes.find((n) => n.label === 'Embeddings')
    expect(embeddings!.x).toBe(200)
  })

  it('preserves edge endpoints using the returned node ids', async () => {
    const user = await testUser()
    const map = await saveStudentMap(user.id, input)
    const from = map.nodes.find((n) => n.id === map.edges[0].fromId)
    const to = map.nodes.find((n) => n.id === map.edges[0].toId)
    expect(from!.label).toBe('Tokenization')
    expect(to!.label).toBe('Embeddings')
  })

  it('updates an existing map when given its id', async () => {
    const user = await testUser()
    const first = await saveStudentMap(user.id, input)
    const second = await saveStudentMap(user.id, {
      ...input,
      id: first.id,
      title: 'Revised',
      nodes: [{ id: 'n1', label: 'Tokenization', x: 0, y: 0 }],
      edges: [],
    })
    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Revised')
    expect(second.nodes).toHaveLength(1)
    expect(second.edges).toHaveLength(0)
  })

  it('throws NOT_FOUND for an unknown course slug', async () => {
    const user = await testUser()
    await expect(
      saveStudentMap(user.id, { ...input, courseSlug: 'nope' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('findStudentMap', () => {
  it('returns the saved map', async () => {
    const user = await testUser()
    const saved = await saveStudentMap(user.id, input)
    const found = await findStudentMap(saved.id)
    expect(found!.title).toBe('My first attempt')
  })

  it('returns null for an unknown id', async () => {
    await expect(findStudentMap('nope')).resolves.toBeNull()
  })
})

describe('listStudentMaps', () => {
  it('returns the learner maps for a course', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    const maps = await listStudentMaps(user.id, 'generative-ai')
    expect(maps).toHaveLength(1)
  })

  it('does not return maps from another course', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    await expect(listStudentMaps(user.id, 'ai-agents')).resolves.toEqual([])
  })
})

describe('deleteStudentMap', () => {
  it('removes the map and its nodes', async () => {
    const user = await testUser()
    const saved = await saveStudentMap(user.id, input)
    await deleteStudentMap(saved.id)
    expect(await findStudentMap(saved.id)).toBeNull()
  })
})

describe('listAllStudentMaps', () => {
  it('returns maps across every course', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    await saveStudentMap(user.id, {
      ...input,
      courseSlug: 'ai-agents',
      title: 'Agents attempt',
      nodes: [{ id: 'n1', label: 'Tool Calling', x: 0, y: 0 }],
      edges: [],
    })

    const maps = await listAllStudentMaps(user.id)
    expect(maps).toHaveLength(2)
    expect(maps.map((m) => m.courseSlug).sort()).toEqual([
      'ai-agents',
      'generative-ai',
    ])
  })

  it('includes the course title for display', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].courseTitle).toBe('Generative AI Foundations')
  })

  it('orders newest first', async () => {
    const user = await testUser()
    const first = await saveStudentMap(user.id, input)
    const second = await saveStudentMap(user.id, {
      ...input,
      title: 'Second',
    })
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].id).toBe(second.id)
    expect(maps[1].id).toBe(first.id)
  })

  it('returns an empty array for a learner with no maps', async () => {
    await expect(listAllStudentMaps('no-such-user')).resolves.toEqual([])
  })

  it('reports node and edge counts without loading them', async () => {
    const user = await testUser()
    await saveStudentMap(user.id, input)
    const maps = await listAllStudentMaps(user.id)
    expect(maps[0].nodeCount).toBe(2)
    expect(maps[0].edgeCount).toBe(1)
  })
})
