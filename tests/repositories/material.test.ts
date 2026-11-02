// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  createMaterial,
  deleteMaterial,
  findMaterial,
  getChunks,
  listMaterials,
  markFailed,
  storeChunks,
} from '@/lib/repositories/material'

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

afterEach(async () => {
  const user = await testUser()
  await prisma.material.deleteMany({ where: { userId: user.id } })
})

async function newMaterial() {
  const user = await testUser()
  return createMaterial({
    userId: user.id,
    filename: 'notes.txt',
    mimeType: 'text/plain',
    sizeBytes: 100,
  })
}

describe('createMaterial', () => {
  it('creates a material in UPLOADED status', async () => {
    const material = await newMaterial()
    expect(material.status).toBe('UPLOADED')
    expect(material.chunkCount).toBe(0)
  })
})

describe('storeChunks', () => {
  it('stores chunks and flips the material to READY', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['first chunk', 'second chunk'])
    const updated = await findMaterial(material.id)
    expect(updated!.status).toBe('READY')
    expect(updated!.chunkCount).toBe(2)
  })

  it('preserves chunk order', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['alpha', 'bravo', 'charlie'])
    const chunks = await getChunks(material.id)
    expect(chunks.map((c) => c.content)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('replaces previous chunks rather than appending', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['old'])
    await storeChunks(material.id, ['new one', 'new two'])
    const chunks = await getChunks(material.id)
    expect(chunks.map((c) => c.content)).toEqual(['new one', 'new two'])
  })
})

describe('markFailed', () => {
  it('sets the status to FAILED with the reason', async () => {
    const material = await newMaterial()
    await markFailed(material.id, 'Could not read the PDF')
    const updated = await findMaterial(material.id)
    expect(updated!.status).toBe('FAILED')
    expect(updated!.error).toBe('Could not read the PDF')
  })
})

describe('listMaterials', () => {
  it('returns the learner materials newest first', async () => {
    const user = await testUser()
    await createMaterial({ userId: user.id, filename: 'a.txt', mimeType: 'text/plain', sizeBytes: 1 })
    await createMaterial({ userId: user.id, filename: 'b.txt', mimeType: 'text/plain', sizeBytes: 1 })
    const materials = await listMaterials(user.id)
    expect(materials).toHaveLength(2)
    expect(materials[0].filename).toBe('b.txt')
  })

  it('returns an empty array for a learner with no materials', async () => {
    await expect(listMaterials('no-such-user')).resolves.toEqual([])
  })
})

describe('storeChunks embeddings', () => {
  it('stores a vector per chunk', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['first chunk text', 'second chunk text'])
    const chunks = await getChunks(material.id)
    expect(chunks[0].embedding).toHaveLength(384)
    expect(chunks[1].embedding).toHaveLength(384)
  }, 120_000)

  it('gives different content different vectors', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, [
      'Tokenization splits text into subwords.',
      'The CIA triad is confidentiality, integrity, availability.',
    ])
    const chunks = await getChunks(material.id)
    expect(chunks[0].embedding).not.toEqual(chunks[1].embedding)
  }, 120_000)
})

describe('findMaterial', () => {
  it('returns null for an unknown id', async () => {
    await expect(findMaterial('nope')).resolves.toBeNull()
  })
})

describe('deleteMaterial', () => {
  it('removes the material and its chunks', async () => {
    const material = await newMaterial()
    await storeChunks(material.id, ['a', 'b'])
    await deleteMaterial(material.id)
    expect(await findMaterial(material.id)).toBeNull()
    expect(await getChunks(material.id)).toEqual([])
  })
})
