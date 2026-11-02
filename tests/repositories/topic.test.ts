import { describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { findTopicWithConcepts } from '@/lib/repositories/concept'

async function textRepresentationTopicId() {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { title: 'Text Representation' },
  })
  return topic.id
}

describe('findTopicWithConcepts', () => {
  it('returns the topic with its concepts in order', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(topic!.title).toBe('Text Representation')
    expect(topic!.concepts.map((c) => c.name)).toEqual([
      'Tokenization',
      'Embeddings',
      'Context Window',
    ])
  })

  it('includes the course title and slug for breadcrumbs', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(topic!.courseTitle).toBe('Generative AI Foundations')
    expect(topic!.courseSlug).toBe('generative-ai')
  })

  it('parses concept objectives into arrays', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(Array.isArray(topic!.concepts[0].objectives)).toBe(true)
  })

  it('returns the relationships between concepts in the topic', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    expect(Array.isArray(topic!.relationships)).toBe(true)
    expect(topic!.relationships.length).toBeGreaterThan(0)
  })

  it('only returns relationships whose endpoints are both in this topic', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    const conceptIds = new Set(topic!.concepts.map((c) => c.id))
    for (const rel of topic!.relationships) {
      expect(conceptIds.has(rel.fromId)).toBe(true)
      expect(conceptIds.has(rel.toId)).toBe(true)
    }
  })

  it('includes the Tokenization to Embeddings prerequisite edge', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    const byId = new Map(topic!.concepts.map((c) => [c.id, c.name]))
    const edges = topic!.relationships.map(
      (r) => `${byId.get(r.fromId)}->${byId.get(r.toId)}`,
    )
    expect(edges).toContain('Tokenization->Embeddings')
  })

  it('gives every relationship a valid type and strength', async () => {
    const topic = await findTopicWithConcepts(await textRepresentationTopicId())
    for (const rel of topic!.relationships) {
      expect([
        'PREREQUISITE_OF',
        'RELATED_TO',
        'PART_OF',
        'LEADS_TO',
      ]).toContain(rel.type)
      expect(typeof rel.strength).toBe('number')
    }
  })

  it('returns null for an unknown topic id', async () => {
    await expect(findTopicWithConcepts('nope')).resolves.toBeNull()
  })
})
