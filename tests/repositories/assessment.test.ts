import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  createAssessment,
  findAssessment,
  saveAnswers,
} from '@/lib/repositories/assessment'

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

async function topicId() {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { title: 'Text Representation' },
  })
  return topic.id
}

async function conceptIdByName(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

afterEach(async () => {
  const user = await testUser()
  await prisma.assessment.deleteMany({ where: { userId: user.id } })
})

describe('createAssessment', () => {
  it('persists the assessment with its questions', async () => {
    const user = await testUser()
    const assessment = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'What is a token?',
          options: ['A subword unit', 'A whole word'],
          correctAnswer: 'A subword unit',
          explanation: 'Subword units.',
          difficulty: 'BEGINNER',
        },
      ],
    })
    expect(assessment.questions).toHaveLength(1)
    expect(assessment.questions[0].prompt).toBe('What is a token?')
  })

  it('orders questions as given', async () => {
    const user = await testUser()
    const cid = await conceptIdByName('Tokenization')
    const assessment = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        { conceptId: cid, type: 'MCQ', prompt: 'first', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', difficulty: 'BEGINNER' },
        { conceptId: cid, type: 'MCQ', prompt: 'second', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', difficulty: 'BEGINNER' },
      ],
    })
    expect(assessment.questions.map((q) => q.prompt)).toEqual(['first', 'second'])
  })
})

describe('findAssessment', () => {
  it('returns the assessment without leaking correct answers', async () => {
    const user = await testUser()
    const created = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'What is a token?',
          options: ['A subword unit', 'A whole word'],
          correctAnswer: 'A subword unit',
          explanation: 'Subword units.',
          difficulty: 'BEGINNER',
        },
      ],
    })

    const found = await findAssessment(created.id)
    expect(found).not.toBeNull()
    expect(found!.questions[0]).not.toHaveProperty('correctAnswer')
    expect(found!.questions[0]).not.toHaveProperty('explanation')
  })

  it('returns null for an unknown id', async () => {
    await expect(findAssessment('nope')).resolves.toBeNull()
  })
})

describe('saveAnswers', () => {
  it('persists answers and the overall score', async () => {
    const user = await testUser()
    const created = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'q',
          options: ['a', 'b'],
          correctAnswer: 'a',
          explanation: 'e',
          difficulty: 'BEGINNER',
        },
      ],
    })

    await saveAnswers(created.id, 75, [
      {
        questionId: created.questions[0].id,
        response: 'a',
        isCorrect: true,
        score: 1,
        feedback: 'Correct.',
      },
    ])

    const row = await prisma.assessment.findUniqueOrThrow({
      where: { id: created.id },
      include: { answers: true },
    })
    expect(row.score).toBe(75)
    expect(row.submittedAt).not.toBeNull()
    expect(row.answers).toHaveLength(1)
  })
})
