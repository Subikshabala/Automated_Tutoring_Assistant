import prisma from '@/lib/prisma'
import { readStringArray, writeStringArray } from '@/lib/json-array'
import type { Difficulty } from '@/lib/schemas/common'
import type { QuestionDto } from '@/lib/schemas/assessment'

export type NewQuestion = {
  conceptId: string
  type: 'MCQ' | 'SHORT_ANSWER' | 'SCENARIO'
  prompt: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty: Difficulty
}

export type StoredAssessment = {
  id: string
  kind: string
  topicTitle: string | null
  courseSlug: string | null
  score: number | null
  submittedAt: string | null
  questions: QuestionDto[]
}

export async function createAssessment(input: {
  userId: string
  topicId: string
  questions: NewQuestion[]
  kind?: 'practice' | 'diagnostic'
}): Promise<StoredAssessment> {
  const topic = await prisma.topic.findUnique({
    where: { id: input.topicId },
    select: {
      module: { select: { courseId: true } },
    },
  })

  const assessment = await prisma.assessment.create({
    data: {
      userId: input.userId,
      topicId: input.topicId,
      courseId: topic?.module.courseId ?? null,
      kind: input.kind ?? 'practice',
      questions: {
        create: input.questions.map((q, index) => ({
          conceptId: q.conceptId,
          type: q.type,
          prompt: q.prompt,
          options: writeStringArray(q.options),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          order: index,
        })),
      },
    },
  })

  const found = await findAssessment(assessment.id)
  if (!found) throw new Error('Assessment vanished immediately after creation')
  return found
}

/** Never returns correctAnswer or explanation — those must not reach the client before submission. */
export async function findAssessment(
  id: string,
): Promise<StoredAssessment | null> {
  const row = await prisma.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { concept: { select: { name: true } } },
      },
    },
  })
  if (!row) return null

  const topic = row.topicId
    ? await prisma.topic.findUnique({
        where: { id: row.topicId },
        select: {
          title: true,
          module: { select: { course: { select: { slug: true } } } },
        },
      })
    : null

  return {
    id: row.id,
    kind: row.kind,
    topicTitle: topic?.title ?? null,
    courseSlug: topic?.module.course.slug ?? null,
    score: row.score,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    questions: row.questions.map((q) => ({
      id: q.id,
      conceptId: q.conceptId,
      conceptName: q.concept.name,
      type: q.type,
      prompt: q.prompt,
      options: readStringArray(q.options),
      difficulty: q.difficulty,
      order: q.order,
    })),
  }
}

/** Full question rows including the answer key — server-side grading only. */
export async function findQuestionsForGrading(assessmentId: string) {
  const rows = await prisma.question.findMany({
    where: { assessmentId },
    include: { concept: { select: { id: true, name: true, definition: true } } },
    orderBy: { order: 'asc' },
  })
  return rows.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    conceptId: q.concept.id,
    conceptName: q.concept.name,
    conceptDefinition: q.concept.definition,
  }))
}

export async function saveAnswers(
  assessmentId: string,
  score: number,
  answers: {
    questionId: string
    response: string
    isCorrect: boolean
    score: number
    feedback: string
  }[],
): Promise<void> {
  await prisma.$transaction([
    prisma.answer.deleteMany({ where: { assessmentId } }),
    prisma.answer.createMany({
      data: answers.map((a) => ({ assessmentId, ...a })),
    }),
    prisma.assessment.update({
      where: { id: assessmentId },
      data: { score, submittedAt: new Date() },
    }),
  ])
}
